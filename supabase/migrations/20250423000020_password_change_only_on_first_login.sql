-- =====================================================
-- Migration: Passwort-Wechsel nur beim Erst-Login, nicht alle N Logins
-- =====================================================
-- Bug: record_login() zwang Passwort-Wechsel auch wenn login_count >= 3.
-- Bei general@ (Session-Ablauf alle 2h → mehrere Logins/Tag) löste das alle
-- paar Tage erneut den Wechsel-Modal aus, obwohl der User schon ein eigenes
-- Passwort gesetzt hatte.
--
-- Fix: Nur noch das explizite must_change_password-Flag erzwingt den Wechsel.
-- Das Flag wird einmal beim Erst-Setup auf true gesetzt und nach erfolgreichem
-- Wechsel (mark_password_changed) auf false. Danach nie wieder.

CREATE OR REPLACE FUNCTION record_login()
RETURNS TABLE(must_change_password BOOLEAN, login_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE admin_profiles
  SET login_count = admin_profiles.login_count + 1,
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN QUERY
  SELECT ap.must_change_password,
         ap.login_count
  FROM admin_profiles ap
  WHERE ap.id = v_user_id;
END $$;

GRANT EXECUTE ON FUNCTION record_login() TO authenticated;
