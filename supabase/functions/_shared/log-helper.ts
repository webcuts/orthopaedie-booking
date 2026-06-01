// Logging-Helper für Edge Functions
// Schreibt Events in die system_logs Tabelle

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Partially masks an email address for logging.
 * "patient@example.com" -> "pa***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

export async function logEvent(
  eventType: string,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    await supabase
      .from('system_logs')
      .insert({
        event_type: eventType,
        message,
        details: details || null,
      })
  } catch (err) {
    // Logging-Fehler sollen nie den Hauptprozess blockieren
    console.error('[log-helper] Failed to log event:', err)
  }
}
