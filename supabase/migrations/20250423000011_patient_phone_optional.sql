-- =====================================================
-- Migration: Patient-Telefonnummer optional machen
-- =====================================================
-- Problem: chk_patient_phone_required ("phone IS NOT NULL AND length >= 6")
-- widerspricht chk_patient_phone_format ("phone IS NULL OR matches regex").
-- Folge: MFA-Buchungen ohne Telefonnummer schlugen mit "Fehler bei der Buchung" fehl,
-- weil das Frontend phone = NULL erlaubt und der NOT-NULL-Check dann verletzt wird.
--
-- Lösung: Required-Constraint ersetzen durch "phone IS NULL ODER length >= 6".
-- Wenn ein Telefon angegeben wird, muss es valide sein. Aber leeres Feld ist OK.

ALTER TABLE patients DROP CONSTRAINT IF EXISTS chk_patient_phone_required;

ALTER TABLE patients ADD CONSTRAINT chk_patient_phone_min_length
  CHECK (
    phone IS NULL
    OR length(trim(phone)) >= 6
  );

-- Verifikation
DO $$
DECLARE
  v_required_still_there BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_patient_phone_required'
      AND conrelid = 'patients'::regclass
  ) INTO v_required_still_there;

  IF v_required_still_there THEN
    RAISE EXCEPTION 'Migration fehlgeschlagen: required-Constraint noch da';
  END IF;

  RAISE NOTICE 'Migration ok: Phone ist jetzt optional.';
END $$;
