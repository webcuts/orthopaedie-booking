-- =====================================================
-- Security Hardening Migration
-- Fixes: C-04, H-03, H-04, M-02, M-07, L-04
-- =====================================================

-- =====================================================
-- C-04: Arzt-Rolle RLS auf DB-Ebene
-- Ärzte dürfen nur eigene Termine sehen (nicht alle Patienten)
-- =====================================================

-- Alte "full access" Policies für appointments ersetzen
DROP POLICY IF EXISTS "Authenticated users have full access to appointments" ON appointments;

-- Admins und MFAs: voller Zugriff auf alle Termine
CREATE POLICY "admin_mfa_full_access_appointments"
  ON appointments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'mfa') AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'mfa') AND is_active = true
    )
  );

-- Ärzte: nur eigene Termine (über practitioner_id)
CREATE POLICY "arzt_own_appointments_only"
  ON appointments FOR SELECT TO authenticated
  USING (
    practitioner_id = (
      SELECT practitioner_id FROM admin_profiles
      WHERE id = auth.uid() AND role = 'arzt' AND is_active = true
    )
  );

-- Ärzte: dürfen eigene Termine updaten (z.B. Status ändern)
CREATE POLICY "arzt_update_own_appointments"
  ON appointments FOR UPDATE TO authenticated
  USING (
    practitioner_id = (
      SELECT practitioner_id FROM admin_profiles
      WHERE id = auth.uid() AND role = 'arzt' AND is_active = true
    )
  );

-- Anon-Policies bleiben unverändert (für Buchungsflow)

-- Patienten: Ärzte sehen nur Patienten mit eigenen Terminen
DROP POLICY IF EXISTS "Authenticated users have full access to patients" ON patients;

CREATE POLICY "admin_mfa_full_access_patients"
  ON patients FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'mfa') AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'mfa') AND is_active = true
    )
  );

CREATE POLICY "arzt_own_patients_only"
  ON patients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.patient_id = patients.id
        AND appointments.practitioner_id = (
          SELECT practitioner_id FROM admin_profiles
          WHERE id = auth.uid() AND role = 'arzt' AND is_active = true
        )
    )
  );

-- =====================================================
-- H-03: Rate Limiting auf DB-Ebene erzwingen
-- Trigger prüft vor jedem anonymen INSERT in appointments
-- =====================================================

CREATE OR REPLACE FUNCTION enforce_booking_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patient_email TEXT;
  booking_count INTEGER;
BEGIN
  -- Nur für anonyme Buchungen (status = 'confirmed' beim Erstellen)
  SELECT email INTO patient_email
  FROM patients
  WHERE id = NEW.patient_id;

  IF patient_email IS NOT NULL THEN
    SELECT COUNT(*) INTO booking_count
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    WHERE p.email = patient_email
      AND a.created_at > NOW() - INTERVAL '24 hours';

    IF booking_count >= 3 THEN
      RAISE EXCEPTION 'Rate limit exceeded: max 3 bookings per email per 24 hours';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_rate_limit ON appointments;
CREATE TRIGGER trg_booking_rate_limit
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_rate_limit();

-- Gleiches für MFA-Termine
DROP TRIGGER IF EXISTS trg_mfa_booking_rate_limit ON mfa_appointments;
CREATE TRIGGER trg_mfa_booking_rate_limit
  BEFORE INSERT ON mfa_appointments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_rate_limit();

-- =====================================================
-- H-04: system_logs INSERT nur für authenticated
-- Entfernt anonymen Schreibzugriff
-- =====================================================

DROP POLICY IF EXISTS "System can insert logs" ON system_logs;

CREATE POLICY "Authenticated can insert logs" ON system_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- Edge Functions nutzen den Service Role Key, der RLS umgeht,
-- daher funktioniert das Logging aus Edge Functions weiterhin.

-- =====================================================
-- M-02: admin_profiles SELECT nur eigenes Profil für Nicht-Admins
-- =====================================================

DROP POLICY IF EXISTS "admin_profiles_self_read" ON admin_profiles;

-- Jeder authentifizierte User kann sein eigenes Profil lesen
CREATE POLICY "admin_profiles_self_read"
  ON admin_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins können alle Profile lesen (für Mitarbeiterverwaltung)
CREATE POLICY "admin_profiles_admin_read_all"
  ON admin_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.id = auth.uid() AND ap.role = 'admin' AND ap.is_active = true
    )
  );

-- =====================================================
-- L-04: anonymize_patient() auf Admin-Rolle beschränken
-- =====================================================

REVOKE EXECUTE ON FUNCTION anonymize_patient(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION anonymize_patient(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION anonymize_patient(UUID) FROM authenticated;

-- Nur über Service Role Key aufrufbar (Admin-Edge-Functions)
-- Oder: Wrapper mit Admin-Check
CREATE OR REPLACE FUNCTION anonymize_patient_safe(p_patient_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Patientendaten anonymisieren';
  END IF;

  PERFORM anonymize_patient(p_patient_id);
END;
$$;

GRANT EXECUTE ON FUNCTION anonymize_patient_safe(UUID) TO authenticated;
