-- =====================================================
-- Spanisch als 6. Sprache hinzufügen
-- =====================================================

-- Neue Spalten
ALTER TABLE insurance_types      ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE specialties          ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE treatment_types      ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE treatment_types      ADD COLUMN IF NOT EXISTS description_es TEXT;
ALTER TABLE mfa_treatment_types  ADD COLUMN IF NOT EXISTS name_es TEXT;

-- Übersetzungen einpflegen
UPDATE insurance_types SET name_es = 'Seguro público'          WHERE name = 'Gesetzlich versichert';
UPDATE insurance_types SET name_es = 'Seguro privado'          WHERE name = 'Privat versichert';

UPDATE specialties SET name_es = 'Ortopedia y cirugía traumatológica'       WHERE name = 'Orthopäde und Unfallchirurg';
UPDATE specialties SET name_es = 'Medicina física y rehabilitadora'         WHERE name = 'Physikalischer und Rehabilitativer Mediziner';

UPDATE treatment_types SET name_es = 'Primera consulta (paciente nuevo)'    WHERE name = 'Erstuntersuchung Neupatient';
UPDATE treatment_types SET name_es = 'Consulta'                             WHERE name = 'Sprechstunde';
UPDATE treatment_types SET name_es = 'Terapia de ondas de choque'           WHERE name = 'Stoßwellentherapie';

UPDATE mfa_treatment_types SET name_es = 'Medicamentos'                     WHERE name = 'Medikamente';
UPDATE mfa_treatment_types SET name_es = 'Tratamiento con PRP'              WHERE name = 'PRP-Behandlung';
UPDATE mfa_treatment_types SET name_es = 'Tratamiento con ácido hialurónico' WHERE name = 'Hyaluronsäure-Behandlung';
UPDATE mfa_treatment_types SET name_es = 'Medición de densidad ósea'        WHERE name = 'Knochendichte-Messung';
