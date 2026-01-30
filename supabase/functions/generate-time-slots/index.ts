// ORTHO-008: Automatischer Zeitslot-Generator
// Supabase Edge Function zum Generieren von Zeitslots

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers für API-Aufrufe
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateRequest {
  weeks_ahead?: number
}

interface GenerateResponse {
  success: boolean
  slots_created: number
  period: string
  message?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Supabase Client mit Service Role für DB-Zugriff
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parameter aus Request Body lesen
    let weeksAhead = 4 // Default: 4 Wochen

    if (req.method === 'POST') {
      try {
        const body: GenerateRequest = await req.json()
        if (body.weeks_ahead && body.weeks_ahead > 0 && body.weeks_ahead <= 52) {
          weeksAhead = body.weeks_ahead
        }
      } catch {
        // Keine Parameter übergeben, verwende Default
      }
    }

    console.log(`[generate-time-slots] Starting generation for ${weeksAhead} weeks ahead`)

    // Rufe die SQL-Funktion auf
    const { data, error } = await supabase
      .rpc('generate_time_slots_with_log', {
        weeks_ahead: weeksAhead,
        triggered_by: 'edge_function'
      })

    if (error) {
      console.error('[generate-time-slots] Database error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    const result = data?.[0] || { success: false, slots_created: 0, period: 'N/A' }

    console.log(`[generate-time-slots] Completed: ${result.slots_created} slots created for period ${result.period}`)

    const response: GenerateResponse = {
      success: result.success,
      slots_created: result.slots_created,
      period: result.period,
      message: `Successfully generated ${result.slots_created} time slots for ${result.period}`
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[generate-time-slots] Error:', error)

    const errorResponse: GenerateResponse = {
      success: false,
      slots_created: 0,
      period: '',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
