// ORTHO-050: Mitarbeiterverwaltung via Edge Function (service_role key)
// Nur Admins können diese Function aufrufen

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateStaffRequest {
  action: 'create' | 'archive' | 'reactivate';
  email?: string;
  password?: string;
  displayName?: string;
  role?: 'admin' | 'mfa';
  userId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verifiziere den aufrufenden User via Auth Header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // JWT des aufrufenden Users prüfen
    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Prüfe ob der aufrufende User Admin ist
    const { data: callingProfile } = await supabase
      .from('admin_profiles')
      .select('role, is_active')
      .eq('id', callingUser.id)
      .single()

    if (!callingProfile || callingProfile.role !== 'admin' || !callingProfile.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nur Administratoren können Mitarbeiter verwalten' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const body: CreateStaffRequest = await req.json()

    if (body.action === 'create') {
      if (!body.email || !body.password || !body.displayName || !body.role) {
        return new Response(
          JSON.stringify({ success: false, error: 'Alle Felder sind erforderlich' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Neuen User erstellen (via Admin API)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { display_name: body.displayName },
      })

      if (createError || !newUser?.user) {
        return new Response(
          JSON.stringify({ success: false, error: createError?.message || 'Benutzer konnte nicht erstellt werden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Admin-Profil erstellen
      const { error: profileError } = await supabase
        .from('admin_profiles')
        .insert({
          id: newUser.user.id,
          display_name: body.displayName,
          role: body.role,
          is_active: true,
        })

      if (profileError) {
        console.error('[manage-staff] Profile creation failed:', profileError)
      }

      console.log(`[manage-staff] Created user ${body.email} with role ${body.role}`)

      return new Response(
        JSON.stringify({ success: true, userId: newUser.user.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (body.action === 'archive' && body.userId) {
      // Archivieren: Profil deaktivieren
      const { error } = await supabase
        .from('admin_profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', body.userId)

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log(`[manage-staff] Archived user ${body.userId}`)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (body.action === 'reactivate' && body.userId) {
      const { error } = await supabase
        .from('admin_profiles')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', body.userId)

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log(`[manage-staff] Reactivated user ${body.userId}`)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ungültige Aktion' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('[manage-staff] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
