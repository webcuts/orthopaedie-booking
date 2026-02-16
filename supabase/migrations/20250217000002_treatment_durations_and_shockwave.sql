-- =====================================================
-- ORTHO-033 + ORTHO-025: Stoßwellentherapie + Behandlungsdauern
-- =====================================================

-- 1. primary_appointment_id für Multi-Slot-Buchungen (15-Min-Termine)
-- Sekundäre Slot-Blockierungen verweisen auf den Haupttermin
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS primary_appointment_id UUID REFERENCES appointments(id);
CREATE INDEX IF NOT EXISTS idx_appointments_primary ON appointments(primary_appointment_id) WHERE primary_appointment_id IS NOT NULL;

-- 2. Behandlungsdauern differenzieren
-- (Migration 20250130000006 hatte alle auf 10 Min. gesetzt)
UPDATE treatment_types SET duration_minutes = 15 WHERE name = 'Erstuntersuchung Neupatient';
UPDATE treatment_types SET duration_minutes = 10 WHERE name = 'Sprechstunde';
UPDATE treatment_types SET duration_minutes = 5  WHERE name = 'Rezepte';

-- 3. Stoßwellentherapie als neue Arzt-Leistung
INSERT INTO treatment_types (name, name_en, name_tr, duration_minutes, description, is_active)
VALUES (
    'Stoßwellentherapie',
    'Shockwave Therapy',
    'Şok Dalga Tedavisi',
    10,
    'Extrakorporale Stoßwellentherapie',
    true
)
ON CONFLICT DO NOTHING;
