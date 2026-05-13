-- =====================================================
-- Migration: Force-Password-Change nach Erst-Login / max. nach 3. Login
-- =====================================================
-- Policy: Jeder neue Account muss spätestens beim 3. Login ein eigenes Passwort setzen.
-- Initial-Markierung wird hier für alle gerade frisch zurückgesetzten User gesetzt.

-- 1. Spalten hinzufügen
ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

-- 2. RPC: wird bei jedem erfolgreichen Login einmal vom Frontend aufgerufen
-- Inkrementiert Counter, gibt zurück ob Passwort-Änderung erforderlich ist
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
  SELECT (ap.must_change_password OR ap.login_count >= 3) AS must_change_password,
         ap.login_count
  FROM admin_profiles ap
  WHERE ap.id = v_user_id;
END $$;

GRANT EXECUTE ON FUNCTION record_login() TO authenticated;

-- 3. RPC: nach erfolgreicher Passwort-Änderung — resettet Status
CREATE OR REPLACE FUNCTION mark_password_changed()
RETURNS VOID
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
  SET must_change_password = false,
      login_count = 0,
      updated_at = NOW()
  WHERE id = v_user_id;
END $$;

GRANT EXECUTE ON FUNCTION mark_password_changed() TO authenticated;

-- 4. Initial: alle Accounts deren Passwort vom System gesetzt wurde markieren
-- Bei den 15 gerade reparierten User-Accounts wissen wir, dass das Passwort von uns
-- generiert wurde → must_change_password = true
UPDATE admin_profiles SET must_change_password = true
WHERE id IN (
  SELECT u.id FROM auth.users u
  WHERE u.email IN (
    'sultan.ercan@praxis-koenigstrasse.de',
    'michael.jonda@praxis-koenigstrasse.de',
    'yulia.namakonova@praxis-koenigstrasse.de',
    'jwan.mohammed@praxis-koenigstrasse.de',
    'vladimir.flores@praxis-koenigstrasse.de',
    'altun.seha@praxis-koenigstrasse.de',
    'burcu.tandogan@praxis-koenigstrasse.de',
    'doerte.kickermann@praxis-koenigstrasse.de',
    'esra.tanc@praxis-koenigstrasse.de',
    'hacice.sueer@praxis-koenigstrasse.de',
    'jamal.salari@praxis-koenigstrasse.de',
    'khatuna.ketiladze@praxis-koenigstrasse.de',
    'luiza.grabowski@praxis-koenigstrasse.de',
    'nina.zilinski@praxis-koenigstrasse.de',
    'general@praxis-koenigstrasse.de',
    'info@praxis-koenigstrasse.de'
  )
);

-- 5. Verifikation
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM admin_profiles WHERE must_change_password = true;
  RAISE NOTICE 'Migration ok: % Accounts werden Passwort-Change beim nächsten Login erzwingen.', v_count;
END $$;
