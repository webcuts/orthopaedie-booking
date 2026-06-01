-- =====================================================
-- Security Hardening Migration — NEUTRALISIERT (2026-06-01)
-- =====================================================
-- ACHTUNG: Diese Migration wurde in der Produktion ausgeführt und hat
-- Probleme verursacht ("Fehler beim Laden der Termine" im Admin-Dashboard).
-- Die Änderungen wurden manuell zurückgerollt.
--
-- Probleme:
--   1. admin_profiles_admin_read_all führte zu infinite recursion
--      (Policy auf admin_profiles las admin_profiles in der USING-Klausel)
--   2. DROP POLICY "Authenticated users have full access to appointments"
--      zielte auf einen Namen der nicht existierte — tatsächlicher Name
--      war 'appointments_admin_all'. Folge: alte Policy blieb aktiv,
--      parallel neue Policies → mehrdeutiger Sicherheits-Zustand.
--   3. Rate-Limit-Trigger blockierte ggf. legitime Buchungs-Flows
--      (3 Buchungen pro 24h pro E-Mail ist zu eng für Multi-Person-Familien).
--
-- Bei Neu-Deployment auf frischer DB: Diese Datei ist ein no-op.
-- Die Sicherheits-Verbesserungen (Arzt-RLS, anonymize_patient-Schutz,
-- system_logs INSERT-Beschränkung) müssen in einer neuen Migration sauber
-- neu implementiert werden — siehe TODO 20250423000028_*.sql (folgt).

-- Idempotenter Cleanup falls diese Migration in einer anderen Umgebung
-- aus Versehen läuft:
DROP POLICY IF EXISTS "admin_mfa_full_access_appointments" ON appointments;
DROP POLICY IF EXISTS "arzt_own_appointments_only" ON appointments;
DROP POLICY IF EXISTS "arzt_update_own_appointments" ON appointments;
DROP POLICY IF EXISTS "admin_mfa_full_access_patients" ON patients;
DROP POLICY IF EXISTS "arzt_own_patients_only" ON patients;
DROP TRIGGER IF EXISTS trg_booking_rate_limit ON appointments;
DROP TRIGGER IF EXISTS trg_mfa_booking_rate_limit ON mfa_appointments;
DROP FUNCTION IF EXISTS enforce_booking_rate_limit();
DROP POLICY IF EXISTS "admin_profiles_admin_read_all" ON admin_profiles;

-- admin_profiles_self_read auf "alle authenticated lesen alle Profile" zurück
-- (alte Policy vor der fehlgeschlagenen Hardening-Migration)
DROP POLICY IF EXISTS "admin_profiles_self_read" ON admin_profiles;
CREATE POLICY "admin_profiles_self_read" ON admin_profiles FOR SELECT
  TO authenticated USING (true);

-- system_logs INSERT wieder für public öffnen
DROP POLICY IF EXISTS "Authenticated can insert logs" ON system_logs;
CREATE POLICY IF NOT EXISTS "System can insert logs" ON system_logs FOR INSERT
  TO public WITH CHECK (true);

-- anonymize_patient Grants restaurieren
GRANT EXECUTE ON FUNCTION anonymize_patient(UUID) TO authenticated;
DROP FUNCTION IF EXISTS anonymize_patient_safe(UUID);
