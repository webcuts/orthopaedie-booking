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
    let bookingType: string | null = null

    if (req.method === 'POST') {
      const body = await req.json()
      cancelToken = body.cancel_token
      bookingType = body.booking_type || null
    } else if (req.method === 'GET') {
      const url = new URL(req.url)
      cancelToken = url.searchParams.get('token')
      bookingType = url.searchParams.get('booking_type')
    }

    if (!cancelToken) {
      return new Response(
        JSON.stringify({ success: false, error_key: 'cancel.invalidToken' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const isMfa = bookingType === 'mfa'

    if (isMfa) {
      // ===== MFA Appointment =====
      const { data: appointment, error: fetchError } = await supabase
        .from('mfa_appointments')
        .select(`
          id,
          status,
          mfa_time_slot_id,
          mfa_time_slot:mfa_time_slots(date, start_time, end_time),
          mfa_treatment_type:mfa_treatment_types(name)
        `)
        .eq('cancel_token', cancelToken)
        .single()

      if (fetchError || !appointment) {
        // Fallback: try doctor appointments if MFA not found
        // (token might be from a doctor appointment)
      } else {
        // GET: nur Details zurückgeben
        if (req.method === 'GET') {
          return new Response(
            JSON.stringify({ success: true, appointment: {
              ...appointment,
              time_slot: appointment.mfa_time_slot,
              treatment_type: appointment.mfa_treatment_type,
              practitioner: null,
            }}),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }

        if (appointment.status === 'cancelled') {
          return new Response(
            JSON.stringify({ success: false, error_key: 'cancel.alreadyCancelled' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const appointmentDate = new Date(`${appointment.mfa_time_slot.date}T${appointment.mfa_time_slot.start_time}`)
        if (appointmentDate < new Date()) {
          return new Response(
            JSON.stringify({ success: false, error_key: 'cancel.pastAppointment' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const deadline = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000)
        if (new Date() > deadline) {
          return new Response(
            JSON.stringify({ success: false, error_key: 'cancel.deadline' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const { error: updateError } = await supabase
          .from('mfa_appointments')
          .update({ status: 'cancelled' })
          .eq('id', appointment.id)

        if (updateError) {
          throw new Error(`Fehler beim Stornieren: ${updateError.message}`)
        }

        // Kein Slot-Release bei MFA (Kapazität wird dynamisch geprüft)

        await supabase
          .from('system_logs')
          .insert({
            event_type: 'cancellation',
            message: `MFA-Termin ${appointment.id} vom Patienten storniert`,
            details: { appointment_id: appointment.id, date: appointment.mfa_time_slot.date, type: 'mfa' },
          })

        console.log(`[cancel-appointment] MFA Appointment ${appointment.id} cancelled successfully`)

        return new Response(
          JSON.stringify({ success: true, appointment }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    // ===== Doctor Appointment (default) =====
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
      // Last resort: try MFA appointments if not explicitly set
      if (!isMfa) {
        const { data: mfaAppointment } = await supabase
          .from('mfa_appointments')
          .select(`
            id,
            status,
            mfa_time_slot_id,
            mfa_time_slot:mfa_time_slots(date, start_time, end_time),
            mfa_treatment_type:mfa_treatment_types(name)
          `)
          .eq('cancel_token', cancelToken)
          .single()

        if (mfaAppointment) {
          // Redirect logic: found in MFA table, handle as MFA
          if (req.method === 'GET') {
            return new Response(
              JSON.stringify({ success: true, appointment: {
                ...mfaAppointment,
                time_slot: mfaAppointment.mfa_time_slot,
                treatment_type: mfaAppointment.mfa_treatment_type,
                practitioner: null,
                booking_type: 'mfa',
              }}),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
          }

          // POST: cancel MFA appointment
          if (mfaAppointment.status === 'cancelled') {
            return new Response(
              JSON.stringify({ success: false, error_key: 'cancel.alreadyCancelled' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          const mfaDate = new Date(`${mfaAppointment.mfa_time_slot.date}T${mfaAppointment.mfa_time_slot.start_time}`)
          if (mfaDate < new Date()) {
            return new Response(
              JSON.stringify({ success: false, error_key: 'cancel.pastAppointment' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          const mfaDeadline = new Date(mfaDate.getTime() - 24 * 60 * 60 * 1000)
          if (new Date() > mfaDeadline) {
            return new Response(
              JSON.stringify({ success: false, error_key: 'cancel.deadline' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          await supabase.from('mfa_appointments').update({ status: 'cancelled' }).eq('id', mfaAppointment.id)

          await supabase.from('system_logs').insert({
            event_type: 'cancellation',
            message: `MFA-Termin ${mfaAppointment.id} vom Patienten storniert`,
            details: { appointment_id: mfaAppointment.id, date: mfaAppointment.mfa_time_slot.date, type: 'mfa' },
          })

          return new Response(
            JSON.stringify({ success: true, appointment: mfaAppointment }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
      }

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
