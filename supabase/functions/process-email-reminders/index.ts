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
  booking_type: string;
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
        const isMfa = reminder.booking_type === 'mfa'
        let emailData: AppointmentData
        let lang: EmailLanguage
        let appointmentStatus: string

        if (isMfa) {
          // MFA-Termin laden
          const { data: appointment, error: appointmentError } = await supabase
            .from('mfa_appointments')
            .select(`
              id,
              status,
              language,
              cancel_token,
              patient:patients(name, email, phone),
              mfa_treatment_type:mfa_treatment_types(name),
              mfa_time_slot:mfa_time_slots(date, start_time, end_time)
            `)
            .eq('id', reminder.appointment_id)
            .single()

          if (appointmentError || !appointment) {
            console.error(`[process-email-reminders] MFA appointment not found: ${reminder.appointment_id}`)
            result.failed++
            result.errors.push(`MFA-Termin ${reminder.appointment_id} nicht gefunden`)

            await supabase
              .from('email_reminders')
              .update({ sent_at: new Date().toISOString() })
              .eq('id', reminder.id)

            continue
          }

          appointmentStatus = appointment.status
          lang = (appointment.language || 'de') as EmailLanguage

          const mfaProviderNames: Record<string, string> = {
            de: 'Praxisleistung (MFA)',
            en: 'Practice Service (MFA)',
            tr: 'Muayenehane Hizmeti (MFA)',
          }

          // Formatiere Stornierungsfrist
          const slotDatetime = new Date(`${appointment.mfa_time_slot.date}T${appointment.mfa_time_slot.start_time}`)
          const deadline = new Date(slotDatetime.getTime() - 24 * 60 * 60 * 1000)
          const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-US', tr: 'tr-TR' }
          const cancellationDeadline = deadline.toLocaleString(localeMap[lang] || 'de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) + (lang === 'de' ? ' Uhr' : '')

          emailData = {
            patientName: appointment.patient.name,
            patientEmail: appointment.patient.email,
            patientPhone: appointment.patient.phone,
            date: appointment.mfa_time_slot.date,
            time: appointment.mfa_time_slot.start_time,
            endTime: appointment.mfa_time_slot.end_time,
            treatmentType: appointment.mfa_treatment_type.name,
            practitionerName: mfaProviderNames[lang] || mfaProviderNames.de,
            cancellationDeadline,
            cancelToken: appointment.cancel_token || undefined,
          }
        } else {
          // Doctor-Termin laden (bestehende Logik)
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

            await supabase
              .from('email_reminders')
              .update({ sent_at: new Date().toISOString() })
              .eq('id', reminder.id)

            continue
          }

          appointmentStatus = appointment.status
          lang = (appointment.language || 'de') as EmailLanguage
          const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-US', tr: 'tr-TR' }

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

          emailData = {
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
        }

        // Überspringe stornierte Termine
        if (appointmentStatus === 'cancelled') {
          console.log(`[process-email-reminders] Skipping cancelled ${isMfa ? 'MFA ' : ''}appointment: ${reminder.appointment_id}`)

          await supabase
            .from('email_reminders')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', reminder.id)

          continue
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
