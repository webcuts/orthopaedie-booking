// ORTHO-007: Buchungsbestätigung per E-Mail
// Wird nach erfolgreicher Buchung vom Frontend aufgerufen

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateBookingConfirmationEmail, getConfirmationSubject, type AppointmentData, type EmailLanguage } from '../_shared/email-templates.ts'
import { sendEmail } from '../_shared/resend.ts'
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: RequestBody = await req.json()
    const { appointmentId, booking_type } = body

    if (!appointmentId) {
      throw new Error('appointmentId ist erforderlich')
    }

    const isMfa = booking_type === 'mfa'
    console.log(`[send-booking-confirmation] Processing ${isMfa ? 'MFA' : 'doctor'} appointment: ${appointmentId}`)

    let emailData: AppointmentData
    let lang: EmailLanguage

    if (isMfa) {
      // MFA-Termin laden
      const { data: appointment, error: appointmentError } = await supabase
        .from('mfa_appointments')
        .select(`
          *,
          patient:patients(name, email, phone, insurance_type_id),
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
      // Doctor-Termin laden (bestehende Logik)
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(name, email, phone, insurance_type_id),
          treatment_type:treatment_types(name),
          time_slot:time_slots(date, start_time, end_time),
          practitioner:practitioners(title, first_name, last_name, specialty_id)
        `)
        .eq('id', appointmentId)
        .single()

      if (appointmentError || !appointment) {
        throw new Error(`Termin nicht gefunden: ${appointmentError?.message}`)
      }

      // Lade Specialty wenn Practitioner vorhanden
      let specialtyName: string | undefined
      if (appointment.practitioner?.specialty_id) {
        const { data: specialty } = await supabase
          .from('specialties')
          .select('name')
          .eq('id', appointment.practitioner.specialty_id)
          .single()
        specialtyName = specialty?.name
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
        specialtyName,
        cancelToken: appointment.cancel_token || undefined,
        appointmentId,
      }
    }

    // Generiere HTML
    const html = generateBookingConfirmationEmail(emailData, lang)

    // Sende E-Mail
    const result = await sendEmail({
      to: emailData.patientEmail,
      subject: getConfirmationSubject(lang, emailData.practitionerName),
      html,
    })

    if (!result.success) {
      console.error(`[send-booking-confirmation] Failed to send email: ${result.error}`)
      await logEvent('error', `Bestätigungsmail fehlgeschlagen: ${result.error}`, { appointmentId, email: emailData.patientEmail })
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log(`[send-booking-confirmation] Email sent to ${emailData.patientEmail}`)
    await logEvent('booking', `Bestätigungsmail gesendet an ${emailData.patientEmail}`, { appointmentId })

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        recipient: emailData.patientEmail,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[send-booking-confirmation] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
