-- =====================================================
-- Migration 014: Validation Constraints anpassen
-- Name max 50 Zeichen (statt 100), Telefon min 6 / max 20 (statt 5/30)
-- =====================================================

-- Bestehende Daten bereinigen bevor neue Constraints greifen
-- Namen kürzen falls > 50 Zeichen
UPDATE patients SET name = LEFT(TRIM(name), 50)
  WHERE char_length(TRIM(name)) > 50;

-- Telefonnummern trimmen
UPDATE patients SET phone = TRIM(phone)
  WHERE phone IS NOT NULL AND phone != TRIM(phone);

-- Ungültige Telefonnummern auf NULL setzen (Feld ist jetzt optional)
UPDATE patients SET phone = NULL
  WHERE phone IS NOT NULL
    AND NOT (phone ~ '^[+]?[0-9 ()\-/]{6,20}$');

-- Name: 2-100 → 2-50
ALTER TABLE patients DROP CONSTRAINT IF EXISTS chk_patient_name_length;
ALTER TABLE patients ADD CONSTRAINT chk_patient_name_length
  CHECK (char_length(TRIM(name)) BETWEEN 2 AND 50);

-- Telefon: 5-30 → 6-20
ALTER TABLE patients DROP CONSTRAINT IF EXISTS chk_patient_phone_format;
ALTER TABLE patients ADD CONSTRAINT chk_patient_phone_format
  CHECK (phone IS NULL OR phone ~ '^[+]?[0-9 ()\-/]{6,20}$');
