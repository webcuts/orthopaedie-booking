// ORTHO-007: Praxis-Benachrichtigung per E-Mail
// Wird nach erfolgreicher Buchung vom Frontend aufgerufen

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generatePracticeNotificationEmail, type AppointmentData } from '../_shared/email-templates.ts'
import { sendEmail } from '../_shared/resend.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  appointmentId: string;
}

// Fallback Praxis-E-Mail
const DEFAULT_PRACTICE_EMAIL = 'praxis@orthopaedie-koenigstrasse.de'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const practiceEmail = Deno.env.get('PRACTICE_EMAIL') || DEFAULT_PRACTICE_EMAIL
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: RequestBody = await req.json()
    const { appointmentId } = body

    if (!appointmentId) {
      throw new Error('appointmentId ist erforderlich')
    }

    console.log(`[send-practice-notification] Processing appointment: ${appointmentId}`)

    // Lade Termin mit allen Details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(name, email, phone, insurance_type_id),
        treatment_type:treatment_types(name),
        time_slot:time_slots(date, start_time, end_time),
        practitioner:practitioners(title, first_name, last_name)
      `)
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      throw new Error(`Termin nicht gefunden: ${appointmentError?.message}`)
    }

    // Lade Versicherungsart
    let insuranceType: string | undefined
    if (appointment.patient?.insurance_type_id) {
      const { data: insurance } = await supabase
        .from('insurance_types')
        .select('name')
        .eq('id', appointment.patient.insurance_type_id)
        .single()
      insuranceType = insurance?.name
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
      insuranceType,
    }

    // Generiere HTML
    const html = generatePracticeNotificationEmail(emailData)

    // Sende E-Mail an Praxis
    const result = await sendEmail({
      to: practiceEmail,
      subject: `Neue Terminbuchung - ${emailData.patientName}`,
      html,
    })

    if (!result.success) {
      console.error(`[send-practice-notification] Failed to send email: ${result.error}`)
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log(`[send-practice-notification] Email sent to ${practiceEmail}`)

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        recipient: practiceEmail,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[send-practice-notification] Error:', error)

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
