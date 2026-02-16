-- =====================================================
-- ORTHO-026: E-Mail/Telefon Entweder-oder Logik
-- E-Mail wird optional, mindestens E-Mail oder Telefon erforderlich
-- =====================================================

-- 1. Email nullable machen
ALTER TABLE patients ALTER COLUMN email DROP NOT NULL;

-- 2. Entweder-oder Constraint: email ODER phone muss gesetzt sein
ALTER TABLE patients
  ADD CONSTRAINT chk_patient_contact_required
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- 3. Rate Limit Funktion: auch Phone unterstützen
--    Alte Signatur (TEXT) wird durch neue (TEXT, TEXT) ersetzt
CREATE OR REPLACE FUNCTION check_booking_rate_limit(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) < 3
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  WHERE a.created_at > NOW() - INTERVAL '24 hours'
    AND (
      (p_email IS NOT NULL AND p.email = p_email)
      OR (p_email IS NULL AND p_phone IS NOT NULL AND p.phone = p_phone)
    );
$$;

-- Berechtigungen für neue Signatur
GRANT EXECUTE ON FUNCTION check_booking_rate_limit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_booking_rate_limit(TEXT, TEXT) TO authenticated;
