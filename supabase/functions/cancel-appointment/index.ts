// Stornierung via Cancel-Token
// POST: Termin stornieren
// GET: Termindetails abrufen (ohne Stornierung)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let cancelToken: string | null = null

    if (req.method === 'POST') {
      const body = await req.json()
      cancelToken = body.cancel_token
    } else if (req.method === 'GET') {
      const url = new URL(req.url)
      cancelToken = url.searchParams.get('token')
    }

    if (!cancelToken) {
      return new Response(
        JSON.stringify({ success: false, error_key: 'cancel.invalidToken' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Lade Termin mit Token
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        time_slot_id,
        time_slot:time_slots(date, start_time, end_time),
        treatment_type:treatment_types(name),
        practitioner:practitioners(title, first_name, last_name)
      `)
      .eq('cancel_token', cancelToken)
      .single()

    if (fetchError || !appointment) {
      return new Response(
        JSON.stringify({ success: false, error_key: 'cancel.invalidToken' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // GET: nur Details zurückgeben
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ success: true, appointment }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // POST: Stornierung durchführen

    // Prüfe: bereits storniert?
    if (appointment.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, error_key: 'cancel.alreadyCancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Prüfe: Termin in der Vergangenheit?
    const appointmentDate = new Date(`${appointment.time_slot.date}T${appointment.time_slot.start_time}`)
    if (appointmentDate < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error_key: 'cancel.pastAppointment' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Prüfe: 24h-Frist
    const deadline = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000)
    if (new Date() > deadline) {
      return new Response(
        JSON.stringify({ success: false, error_key: 'cancel.deadline' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Status auf cancelled setzen
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id)

    if (updateError) {
      throw new Error(`Fehler beim Stornieren: ${updateError.message}`)
    }

    // Time-Slot freigeben
    await supabase
      .from('time_slots')
      .update({ is_available: true })
      .eq('id', appointment.time_slot_id)

    // Log the cancellation
    await supabase
      .from('system_logs')
      .insert({
        event_type: 'cancellation',
        message: `Termin ${appointment.id} vom Patienten storniert`,
        details: { appointment_id: appointment.id, date: appointment.time_slot.date },
      })

    console.log(`[cancel-appointment] Appointment ${appointment.id} cancelled successfully`)

    return new Response(
      JSON.stringify({ success: true, appointment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[cancel-appointment] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error_key: 'cancel.error',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
