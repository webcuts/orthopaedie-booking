-- =====================================================
-- ORTHO-045: Telefonnummer als Pflichtfeld
-- Phone wird NOT NULL, bestehende NULL-Einträge erhalten Platzhalter
-- =====================================================

-- 1. Bestehende Einträge ohne Telefonnummer mit Platzhalter füllen
-- Platzhalter muss chk_patient_phone_format erfüllen: ^[+]?[0-9 ()\-/]{6,20}$
UPDATE patients
SET phone = '000000'
WHERE phone IS NULL OR phone = '';

-- 2. Phone auf NOT NULL setzen
ALTER TABLE patients ALTER COLUMN phone SET NOT NULL;

-- 3. Bestehenden Entweder-oder Constraint entfernen (nicht mehr nötig,
--    da phone jetzt immer gesetzt ist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_patient_contact_required'
  ) THEN
    ALTER TABLE patients DROP CONSTRAINT chk_patient_contact_required;
  END IF;
END
$$;

-- 4. Neuen Constraint: phone ist immer Pflicht (NOT NULL reicht,
--    aber expliziter Check für nicht-leere Strings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_patient_phone_required'
  ) THEN
    ALTER TABLE patients
      ADD CONSTRAINT chk_patient_phone_required
      CHECK (phone IS NOT NULL AND length(trim(phone)) >= 6);
  END IF;
END
$$;
