-- =====================================================
-- Migration 011: Input Validation CHECK Constraints
-- Zweite Schutzschicht falls Frontend-Validierung umgangen wird
-- =====================================================

-- Bestehende Daten bereinigen bevor Constraints greifen
UPDATE patients SET name = TRIM(name) WHERE name != TRIM(name);
UPDATE patients SET email = TRIM(email) WHERE email != TRIM(email);
UPDATE patients SET phone = TRIM(phone) WHERE phone IS NOT NULL AND phone != TRIM(phone);

-- patients.name: 2-100 Zeichen
ALTER TABLE patients
  ADD CONSTRAINT chk_patient_name_length
  CHECK (char_length(TRIM(name)) BETWEEN 2 AND 100);

-- patients.email: Gültiges E-Mail-Format
ALTER TABLE patients
  ADD CONSTRAINT chk_patient_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$');

-- patients.phone: Gültiges Telefon-Format (optional)
-- Nutze [0-9] statt \d da PostgreSQL POSIX-Regex verwendet
ALTER TABLE patients
  ADD CONSTRAINT chk_patient_phone_format
  CHECK (phone IS NULL OR phone ~ '^[+]?[0-9 ()\-/]{5,30}$');
