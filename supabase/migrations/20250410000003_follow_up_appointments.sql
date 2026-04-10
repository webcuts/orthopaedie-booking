-- =====================================================
-- ORTHO-058: Folgetermine — MFAs können Terminketten vergeben
-- Neue Spalten: follow_up_count auf mfa_treatment_types,
-- parent_appointment_id auf mfa_appointments
-- =====================================================

-- 1. Anzahl der Folgetermine pro Behandlungstyp
ALTER TABLE mfa_treatment_types
ADD COLUMN follow_up_count INTEGER NOT NULL DEFAULT 0;

-- 2. Verknüpfung von Folgeterminen zum Ersttermin
ALTER TABLE mfa_appointments
ADD COLUMN parent_appointment_id UUID REFERENCES mfa_appointments(id) ON DELETE SET NULL;

CREATE INDEX idx_mfa_follow_ups ON mfa_appointments(parent_appointment_id)
WHERE parent_appointment_id IS NOT NULL;

-- 3. Seed-Daten: PRP und Hyaluronsäure brauchen je 2 Folgetermine (3 total)
UPDATE mfa_treatment_types SET follow_up_count = 2 WHERE name = 'PRP-Behandlung';
UPDATE mfa_treatment_types SET follow_up_count = 2 WHERE name = 'Hyaluronsäure-Behandlung';

-- Kommentare
COMMENT ON COLUMN mfa_treatment_types.follow_up_count IS 'Anzahl benötigter Folgetermine (0 = kein Folgetermin)';
COMMENT ON COLUMN mfa_appointments.parent_appointment_id IS 'Verweis auf den Ersttermin bei Folgeterminen';
