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
    const { appointmentId } = body

    if (!appointmentId) {
      throw new Error('appointmentId ist erforderlich')
    }

    console.log(`[send-booking-confirmation] Processing appointment: ${appointmentId}`)

    // Lade Termin mit allen Details
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
      specialtyName,
      cancelToken: appointment.cancel_token || undefined,
      appointmentId,
    }

    // Sprache des Patienten auslesen
    const lang = (appointment.language || 'de') as EmailLanguage

    // Generiere HTML
    const html = generateBookingConfirmationEmail(emailData, lang)

    // Sende E-Mail
    const result = await sendEmail({
      to: emailData.patientEmail,
      subject: getConfirmationSubject(lang),
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
