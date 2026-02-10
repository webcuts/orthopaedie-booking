-- Migration: Mehrsprachigkeit Fix
-- Ergänzt fehlende Übersetzungsspalten für specialties
-- und korrigiert treatment_types Übersetzungen (korrekte DB-Namen)
-- Fügt description_en/description_tr für treatment_types hinzu

-- =====================================================
-- 1. Übersetzungsspalten für specialties
-- =====================================================

ALTER TABLE specialties ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- =====================================================
-- 2. Beschreibungs-Übersetzungen für treatment_types
-- =====================================================

ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- =====================================================
-- 3. Specialties übersetzen
-- =====================================================

UPDATE specialties SET
  name_en = CASE name
    WHEN 'Orthopäde und Unfallchirurg' THEN 'Orthopaedics and Trauma Surgery'
    WHEN 'Physikalischer und Rehabilitativer Mediziner' THEN 'Physical and Rehabilitative Medicine'
    ELSE name
  END,
  name_tr = CASE name
    WHEN 'Orthopäde und Unfallchirurg' THEN 'Ortopedi ve Travmatoloji'
    WHEN 'Physikalischer und Rehabilitativer Mediziner' THEN 'Fiziksel Tıp ve Rehabilitasyon'
    ELSE name
  END;

-- =====================================================
-- 4. Treatment Types korrigieren (tatsächliche DB-Namen)
-- =====================================================

UPDATE treatment_types SET
  name_en = CASE name
    WHEN 'Erstuntersuchung Neupatient' THEN 'Initial Examination (New Patient)'
    WHEN 'Sprechstunde' THEN 'Consultation'
    WHEN 'Rezepte' THEN 'Prescriptions'
    WHEN 'Erstberatung' THEN 'Initial Consultation'
    WHEN 'Kontrolluntersuchung' THEN 'Follow-up Examination'
    WHEN 'Manuelle Therapie' THEN 'Manual Therapy'
    WHEN 'Röntgenbesprechung' THEN 'X-Ray Discussion'
    WHEN 'Injektionstherapie' THEN 'Injection Therapy'
    ELSE name
  END,
  name_tr = CASE name
    WHEN 'Erstuntersuchung Neupatient' THEN 'İlk Muayene (Yeni Hasta)'
    WHEN 'Sprechstunde' THEN 'Muayene'
    WHEN 'Rezepte' THEN 'Reçete'
    WHEN 'Erstberatung' THEN 'İlk Muayene'
    WHEN 'Kontrolluntersuchung' THEN 'Kontrol Muayenesi'
    WHEN 'Manuelle Therapie' THEN 'Manuel Terapi'
    WHEN 'Röntgenbesprechung' THEN 'Röntgen Değerlendirmesi'
    WHEN 'Injektionstherapie' THEN 'Enjeksiyon Tedavisi'
    ELSE name
  END;

-- =====================================================
-- 5. Treatment Type Beschreibungen übersetzen
-- =====================================================

UPDATE treatment_types SET
  description_en = CASE description
    WHEN 'Ersttermin für neue Patienten' THEN 'First appointment for new patients'
    WHEN 'Kontrolltermin für Bestandspatienten' THEN 'Follow-up for existing patients'
    WHEN 'Rezeptabholung' THEN 'Prescription pickup'
    ELSE description
  END,
  description_tr = CASE description
    WHEN 'Ersttermin für neue Patienten' THEN 'Yeni hastalar için ilk randevu'
    WHEN 'Kontrolltermin für Bestandspatienten' THEN 'Mevcut hastalar için kontrol'
    WHEN 'Rezeptabholung' THEN 'Reçete teslimi'
    ELSE description
  END
WHERE description IS NOT NULL;
