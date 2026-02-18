// ORTHO-031: Terminverlegung E-Mail-Benachrichtigung
// Wird nach erfolgreicher Verlegung vom Admin-Dashboard aufgerufen

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateRescheduleEmail, getRescheduleSubject, type AppointmentData, type EmailLanguage } from '../_shared/email-templates.ts'
import { sendEmail } from '../_shared/resend.ts'
import { logEvent } from '../_shared/log-helper.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  appointmentId: string;
  bookingType?: 'doctor' | 'mfa';
  oldDate: string;
  oldTime: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: RequestBody = await req.json()
    const { appointmentId, bookingType, oldDate, oldTime } = body

    if (!appointmentId || !oldDate || !oldTime) {
      throw new Error('appointmentId, oldDate und oldTime sind erforderlich')
    }

    const isMfa = bookingType === 'mfa'
    console.log(`[send-reschedule-notification] Processing ${isMfa ? 'MFA' : 'doctor'} appointment: ${appointmentId}`)

    let emailData: AppointmentData
    let lang: EmailLanguage

    if (isMfa) {
      const { data: appointment, error: appointmentError } = await supabase
        .from('mfa_appointments')
        .select(`
          *,
          patient:patients(name, email, phone),
          mfa_treatment_type:mfa_treatment_types(name),
          mfa_time_slot:mfa_time_slots(date, start_time, end_time)
        `)
        .eq('id', appointmentId)
        .single()

      if (appointmentError || !appointment) {
        throw new Error(`MFA-Termin nicht gefunden: ${appointmentError?.message}`)
      }

      lang = (appointment.language || 'de') as EmailLanguage

      const mfaProviderNames: Record<string, string> = {
        de: 'Praxisleistung (MFA)',
        en: 'Practice Service (MFA)',
        tr: 'Muayenehane Hizmeti (MFA)',
      }

      emailData = {
        patientName: appointment.patient.name,
        patientEmail: appointment.patient.email,
        patientPhone: appointment.patient.phone,
        date: appointment.mfa_time_slot.date,
        time: appointment.mfa_time_slot.start_time,
        endTime: appointment.mfa_time_slot.end_time,
        treatmentType: appointment.mfa_treatment_type.name,
        practitionerName: mfaProviderNames[lang] || mfaProviderNames.de,
        cancelToken: appointment.cancel_token || undefined,
        appointmentId,
        bookingType: 'mfa',
      }
    } else {
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(name, email, phone),
          treatment_type:treatment_types(name),
          time_slot:time_slots(date, start_time, end_time),
          practitioner:practitioners(title, first_name, last_name)
        `)
        .eq('id', appointmentId)
        .single()

      if (appointmentError || !appointment) {
        throw new Error(`Termin nicht gefunden: ${appointmentError?.message}`)
      }

      lang = (appointment.language || 'de') as EmailLanguage

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
        cancelToken: appointment.cancel_token || undefined,
        appointmentId,
      }
    }

    // Guard: Kein E-Mail-Versand wenn Patient keine E-Mail hat
    if (!emailData.patientEmail) {
      console.log(`[send-reschedule-notification] No email for patient, skipping`)
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Generiere HTML
    const html = generateRescheduleEmail(emailData, oldDate, oldTime, lang)

    // Sende E-Mail
    const result = await sendEmail({
      to: emailData.patientEmail,
      subject: getRescheduleSubject(lang, emailData.date, emailData.time),
      html,
    })

    if (!result.success) {
      console.error(`[send-reschedule-notification] Failed to send email: ${result.error}`)
      await logEvent('error', `Verlegungsmail fehlgeschlagen: ${result.error}`, { appointmentId, email: emailData.patientEmail })
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`[send-reschedule-notification] Email sent to ${emailData.patientEmail}`)
    await logEvent('reschedule', `Verlegungsmail gesendet an ${emailData.patientEmail}`, { appointmentId, oldDate, oldTime })

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        recipient: emailData.patientEmail,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[send-reschedule-notification] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
