// ORTHO-021: Kalender-Download (.ics) für Terminbuchungen
// GET /generate-ics?appointment_id=xxx → .ics Datei

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatIcsDate(date: string, time: string): string {
  // date: "2026-02-12", time: "10:30:00" → "20260212T103000"
  const d = date.replace(/-/g, '')
  const t = time.replace(/:/g, '').slice(0, 6)
  return `${d}T${t}`
}

function escapeIcs(text: string): string {
  return text.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n')
}

function generateUid(appointmentId: string): string {
  return `${appointmentId}@orthopaedie-koenigstrasse.de`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const appointmentId = url.searchParams.get('appointment_id')
    const bookingType = url.searchParams.get('booking_type') || 'doctor'

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: 'appointment_id parameter required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    let dtStart: string
    let dtEnd: string
    let summary: string
    let description: string

    if (bookingType === 'mfa') {
      // MFA-Termin
      const { data: appointment, error } = await supabase
        .from('mfa_appointments')
        .select(`
          id,
          mfa_time_slot:mfa_time_slots(date, start_time, end_time),
          mfa_treatment_type:mfa_treatment_types(name)
        `)
        .eq('id', appointmentId)
        .single()

      if (error || !appointment) {
        return new Response(
          JSON.stringify({ error: 'MFA appointment not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      const timeSlot = Array.isArray(appointment.mfa_time_slot) ? appointment.mfa_time_slot[0] : appointment.mfa_time_slot
      const treatmentType = Array.isArray(appointment.mfa_treatment_type) ? appointment.mfa_treatment_type[0] : appointment.mfa_treatment_type

      dtStart = formatIcsDate(timeSlot.date, timeSlot.start_time)
      dtEnd = formatIcsDate(timeSlot.date, timeSlot.end_time)
      summary = `Orthopädie - ${treatmentType?.name || 'Praxisleistung'}`
      description = 'Praxisleistung (MFA)'
    } else {
      // Doctor-Termin
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          id,
          time_slot:time_slots(date, start_time, end_time),
          treatment_type:treatment_types(name),
          practitioner:practitioners(title, first_name, last_name)
        `)
        .eq('id', appointmentId)
        .single()

      if (error || !appointment) {
        return new Response(
          JSON.stringify({ error: 'Appointment not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      const timeSlot = Array.isArray(appointment.time_slot) ? appointment.time_slot[0] : appointment.time_slot
      const treatmentType = Array.isArray(appointment.treatment_type) ? appointment.treatment_type[0] : appointment.treatment_type
      const practitioner = Array.isArray(appointment.practitioner) ? appointment.practitioner[0] : appointment.practitioner

      dtStart = formatIcsDate(timeSlot.date, timeSlot.start_time)
      dtEnd = formatIcsDate(timeSlot.date, timeSlot.end_time)
      summary = `Orthopädie Termin - ${treatmentType?.name || 'Termin'}`
      const practitionerName = practitioner
        ? `${practitioner.title || ''} ${practitioner.first_name} ${practitioner.last_name}`.trim()
        : ''
      description = practitionerName ? `Behandler: ${practitionerName}` : ''
    }

    const now = new Date()
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Orthopaedie Koenigstrasse//Booking//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${generateUid(appointmentId)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Berlin:${dtStart}`,
      `DTEND;TZID=Europe/Berlin:${dtEnd}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `LOCATION:${escapeIcs('Berliner Allee 14, 30175 Hannover')}`,
      description ? `DESCRIPTION:${escapeIcs(description)}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    return new Response(icsContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="termin.ics"',
      },
      status: 200,
    })
  } catch (error) {
    console.error('[generate-ics] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
