-- =====================================================
-- ORTHO-053: RLS-Policies für MFA vs Admin Rolle
-- MFA: Lese-/Schreibzugriff auf Termine, Patienten, Abwesenheiten, Vorbestellungen
-- MFA: Nur Lesen bei treatment_types, mfa_treatment_types
-- Admin: Vollzugriff auf alles
-- =====================================================

-- Hilfsfunktion: Ist der aktuelle User Admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- treatment_types: MFA nur lesen, Admin alles
-- (bestehende Policies bleiben, hier nur schreibende einschränken)
DO $$
BEGIN
  -- Policy für INSERT/UPDATE/DELETE nur Admin
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'treatment_types_admin_write' AND tablename = 'treatment_types') THEN
    EXECUTE 'CREATE POLICY treatment_types_admin_write ON treatment_types FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())';
  END IF;
END $$;

-- mfa_treatment_types: MFA nur lesen, Admin alles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mfa_treatment_types_admin_write' AND tablename = 'mfa_treatment_types') THEN
    EXECUTE 'CREATE POLICY mfa_treatment_types_admin_write ON mfa_treatment_types FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())';
  END IF;
END $$;

-- system_logs: nur Admin lesen/schreiben (service_role kann immer schreiben)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'system_logs_admin_only' AND tablename = 'system_logs') THEN
    EXECUTE 'CREATE POLICY system_logs_admin_only ON system_logs FOR SELECT TO authenticated USING (is_admin())';
  END IF;
END $$;

-- Bestehende Accounts als MFA eintragen wenn noch kein Profil vorhanden
-- (Admin-Accounts wurden bereits in 20250318000003 erstellt)
INSERT INTO admin_profiles (id, display_name, role, is_active)
SELECT id, COALESCE(raw_user_meta_data->>'display_name', email), 'mfa', true
FROM auth.users
WHERE id NOT IN (SELECT id FROM admin_profiles)
ON CONFLICT (id) DO NOTHING;
