// ORTHO-040: Absage-Benachrichtigung (Praxis-Stornierung)
// Wird vom Admin-Dashboard aufgerufen wenn Praxis einen Termin absagt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateCancellationEmail, getCancellationSubject, type AppointmentData, type EmailLanguage } from '../_shared/email-templates.ts'
import { sendEmail } from '../_shared/resend.ts'
import { sendSms, maskPhone } from '../_shared/twilio.ts'
import { getCancellationSms } from '../_shared/sms-templates.ts'
import { logEvent } from '../_shared/log-helper.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  appointmentId: string;
  booking_type?: 'doctor' | 'mfa';
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
    const { appointmentId, booking_type } = body

    if (!appointmentId) {
      throw new Error('appointmentId ist erforderlich')
    }

    const isMfa = booking_type === 'mfa'
    console.log(`[send-cancellation-notification] Processing ${isMfa ? 'MFA' : 'doctor'} appointment: ${appointmentId}`)

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
        ru: 'Услуга клиники (MFA)',
        ar: 'خدمة العيادة (MFA)',
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
        appointmentId,
      }
    }

    // E-Mail senden wenn vorhanden
    if (emailData.patientEmail) {
      const html = generateCancellationEmail(emailData, lang)
      const result = await sendEmail({
        to: emailData.patientEmail,
        subject: getCancellationSubject(lang),
        html,
      })

      if (result.success) {
        console.log(`[send-cancellation-notification] Email sent to ${emailData.patientEmail}`)
        await logEvent('cancellation', `Absage-E-Mail gesendet an ${emailData.patientEmail}`, { appointmentId })
        return new Response(
          JSON.stringify({ success: true, channel: 'email', messageId: result.messageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } else {
        console.error(`[send-cancellation-notification] Email failed: ${result.error}`)
        await logEvent('error', `Absage-E-Mail fehlgeschlagen: ${result.error}`, { appointmentId })
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    // SMS Fallback wenn kein E-Mail aber Telefon
    if (emailData.patientPhone) {
      console.log(`[send-cancellation-notification] No email, attempting SMS to ${maskPhone(emailData.patientPhone)}`)
      const smsBody = getCancellationSms(emailData, lang)
      const smsResult = await sendSms({ to: emailData.patientPhone, body: smsBody })

      if (smsResult.success) {
        await logEvent('sms', `Absage-SMS gesendet an ${maskPhone(emailData.patientPhone)}`, {
          appointmentId, phone: maskPhone(emailData.patientPhone), messageSid: smsResult.messageSid,
        })
        return new Response(
          JSON.stringify({ success: true, channel: 'sms', messageSid: smsResult.messageSid }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } else {
        console.warn(`[send-cancellation-notification] SMS failed: ${smsResult.error}`)
        await logEvent('warning', `Absage-SMS fehlgeschlagen: ${smsResult.error}`, {
          appointmentId, phone: maskPhone(emailData.patientPhone),
        })
        return new Response(
          JSON.stringify({ success: true, skipped: false, smsError: smsResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    // Weder E-Mail noch Telefon
    console.log(`[send-cancellation-notification] No email and no phone, skipping`)
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: 'no_contact' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[send-cancellation-notification] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
