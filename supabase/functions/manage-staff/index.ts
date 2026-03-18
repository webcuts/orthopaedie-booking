// ORTHO-050/053: Mitarbeiterverwaltung via Edge Function (service_role key)
// Nur Admins können diese Function aufrufen
// Aktionen: create, archive, reactivate, update-role

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StaffRequest {
  action: 'create' | 'archive' | 'reactivate' | 'update-role';
  email?: string;
  password?: string;
  displayName?: string;
  role?: 'admin' | 'mfa';
  userId?: string;
}

async function logAction(supabase: any, message: string, details: Record<string, any>) {
  await supabase.from('system_logs').insert({
    event_type: 'staff',
    message,
    details,
  })
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
      .select('role, is_active, display_name')
      .eq('id', callingUser.id)
      .single()

    if (!callingProfile || callingProfile.role !== 'admin' || !callingProfile.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nur Administratoren können Mitarbeiter verwalten' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const body: StaffRequest = await req.json()
    const adminName = callingProfile.display_name || callingUser.email

    // === CREATE ===
    if (body.action === 'create') {
      if (!body.email || !body.password || !body.displayName || !body.role) {
        return new Response(
          JSON.stringify({ success: false, error: 'Alle Felder sind erforderlich' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

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

      await supabase.from('admin_profiles').insert({
        id: newUser.user.id,
        display_name: body.displayName,
        role: body.role,
        is_active: true,
      })

      await logAction(supabase, `${adminName} hat ${body.displayName} (${body.role}) erstellt`, {
        action: 'create', targetUserId: newUser.user.id, email: body.email, role: body.role,
      })

      return new Response(
        JSON.stringify({ success: true, userId: newUser.user.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // === ARCHIVE ===
    if (body.action === 'archive' && body.userId) {
      const { data: target } = await supabase
        .from('admin_profiles')
        .select('display_name')
        .eq('id', body.userId)
        .single()

      await supabase
        .from('admin_profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', body.userId)

      await logAction(supabase, `${adminName} hat ${target?.display_name || body.userId} archiviert`, {
        action: 'archive', targetUserId: body.userId,
      })

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // === REACTIVATE ===
    if (body.action === 'reactivate' && body.userId) {
      const { data: target } = await supabase
        .from('admin_profiles')
        .select('display_name')
        .eq('id', body.userId)
        .single()

      await supabase
        .from('admin_profiles')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', body.userId)

      await logAction(supabase, `${adminName} hat ${target?.display_name || body.userId} reaktiviert`, {
        action: 'reactivate', targetUserId: body.userId,
      })

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // === UPDATE ROLE ===
    if (body.action === 'update-role' && body.userId && body.role) {
      const { data: target } = await supabase
        .from('admin_profiles')
        .select('display_name, role')
        .eq('id', body.userId)
        .single()

      const oldRole = target?.role || 'unknown'

      await supabase
        .from('admin_profiles')
        .update({ role: body.role, updated_at: new Date().toISOString() })
        .eq('id', body.userId)

      await logAction(supabase, `${adminName} hat Rolle von ${target?.display_name || body.userId} geändert: ${oldRole} → ${body.role}`, {
        action: 'update-role', targetUserId: body.userId, oldRole, newRole: body.role,
      })

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
