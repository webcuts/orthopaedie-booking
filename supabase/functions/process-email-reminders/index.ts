// ORTHO-007: Erinnerungs-E-Mails verarbeiten
// Wird per Cron-Job alle 5 Minuten aufgerufen

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateReminderEmail, getReminderSubject, type AppointmentData, type EmailLanguage } from '../_shared/email-templates.ts'
import { sendEmail } from '../_shared/resend.ts'
import { logEvent } from '../_shared/log-helper.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailReminder {
  id: string;
  appointment_id: string;
  reminder_type: '24h_before' | '6h_before';
  scheduled_for: string;
  sent_at: string | null;
}

interface ProcessingResult {
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const result: ProcessingResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[process-email-reminders] Starting reminder processing...')

    // Finde alle fälligen Erinnerungen
    const { data: reminders, error: remindersError } = await supabase
      .from('email_reminders')
      .select('*')
      .lte('scheduled_for', new Date().toISOString())
      .is('sent_at', null)
      .limit(50) // Batch-Verarbeitung

    if (remindersError) {
      throw new Error(`Fehler beim Laden der Erinnerungen: ${remindersError.message}`)
    }

    if (!reminders || reminders.length === 0) {
      console.log('[process-email-reminders] No pending reminders found')
      return new Response(
        JSON.stringify({ success: true, message: 'Keine fälligen Erinnerungen', ...result }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`[process-email-reminders] Found ${reminders.length} pending reminders`)

    // Verarbeite jede Erinnerung
    for (const reminder of reminders as EmailReminder[]) {
      result.processed++

      try {
        // Prüfe ob Termin nicht storniert wurde
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .select(`
            id,
            status,
            language,
            cancellation_deadline,
            cancel_token,
            patient:patients(name, email, phone),
            treatment_type:treatment_types(name),
            time_slot:time_slots(date, start_time, end_time),
            practitioner:practitioners(title, first_name, last_name)
          `)
          .eq('id', reminder.appointment_id)
          .single()

        if (appointmentError || !appointment) {
          console.error(`[process-email-reminders] Appointment not found: ${reminder.appointment_id}`)
          result.failed++
          result.errors.push(`Termin ${reminder.appointment_id} nicht gefunden`)

          // Markiere als verarbeitet (um Endlosschleife zu vermeiden)
          await supabase
            .from('email_reminders')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', reminder.id)

          continue
        }

        // Überspringe stornierte Termine
        if (appointment.status === 'cancelled') {
          console.log(`[process-email-reminders] Skipping cancelled appointment: ${reminder.appointment_id}`)

          // Markiere als verarbeitet
          await supabase
            .from('email_reminders')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', reminder.id)

          continue
        }

        // Sprache des Patienten auslesen
        const lang = (appointment.language || 'de') as EmailLanguage
        const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-US', tr: 'tr-TR' }

        // Formatiere Stornierungsfrist
        let cancellationDeadline: string | undefined
        if (appointment.cancellation_deadline) {
          const deadline = new Date(appointment.cancellation_deadline)
          cancellationDeadline = deadline.toLocaleString(localeMap[lang] || 'de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) + (lang === 'de' ? ' Uhr' : '')
        }

        // Erstelle E-Mail-Daten
        const emailData: AppointmentData = {
          patientName: appointment.patient.name,
          patientEmail: appointment.patient.email,
          patientPhone: appointment.patient.phone,
          date: appointment.time_slot.date,
          time: appointment.time_slot.start_time,
          endTime: appointment.time_slot.end_time,
          treatmentType: appointment.treatment_type.name,
          practitionerName: appointment.practitioner
            ? `${appointment.practitioner.title || ''} ${appointment.practitioner.first_name} ${appointment.practitioner.last_name}`.trim()
            : null,
          cancellationDeadline,
          cancelToken: appointment.cancel_token || undefined,
        }

        // Generiere HTML
        const html = generateReminderEmail(emailData, reminder.reminder_type, lang)

        // Bestimme Betreff
        const subject = getReminderSubject(reminder.reminder_type, lang)

        // Sende E-Mail
        const sendResult = await sendEmail({
          to: emailData.patientEmail,
          subject,
          html,
        })

        if (sendResult.success) {
          console.log(`[process-email-reminders] Reminder sent to ${emailData.patientEmail}`)
          result.sent++

          // Markiere als gesendet
          await supabase
            .from('email_reminders')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', reminder.id)
        } else {
          console.error(`[process-email-reminders] Failed to send reminder: ${sendResult.error}`)
          result.failed++
          result.errors.push(`Versand an ${emailData.patientEmail} fehlgeschlagen: ${sendResult.error}`)
        }

      } catch (err) {
        console.error(`[process-email-reminders] Error processing reminder ${reminder.id}:`, err)
        result.failed++
        result.errors.push(err instanceof Error ? err.message : 'Unbekannter Fehler')
      }
    }

    console.log(`[process-email-reminders] Completed: ${result.sent} sent, ${result.failed} failed`)

    if (result.sent > 0 || result.failed > 0) {
      await logEvent('email', `Erinnerungen: ${result.sent} gesendet, ${result.failed} fehlgeschlagen`, { ...result })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${result.sent} Erinnerungen gesendet, ${result.failed} fehlgeschlagen`,
        ...result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[process-email-reminders] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        ...result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
