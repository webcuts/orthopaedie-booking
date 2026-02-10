-- Migration: Mehrsprachigkeit (DE, EN, TR)
-- Fügt Übersetzungsspalten für dynamische Inhalte hinzu
-- und speichert die Sprache pro Buchung für E-Mail-Versand

-- =====================================================
-- 1. Übersetzungsspalten für treatment_types
-- =====================================================

ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- =====================================================
-- 2. Übersetzungsspalten für insurance_types
-- =====================================================

ALTER TABLE insurance_types ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE insurance_types ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- =====================================================
-- 3. Sprache pro Buchung (für E-Mail-Versand)
-- =====================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'de';

-- =====================================================
-- 4. Startwerte: Behandlungsarten übersetzen
-- =====================================================

UPDATE treatment_types SET
  name_en = CASE name
    WHEN 'Erstberatung' THEN 'Initial Consultation'
    WHEN 'Kontrolluntersuchung' THEN 'Follow-up Examination'
    WHEN 'Manuelle Therapie' THEN 'Manual Therapy'
    WHEN 'Röntgenbesprechung' THEN 'X-Ray Discussion'
    WHEN 'Injektionstherapie' THEN 'Injection Therapy'
    ELSE name
  END,
  name_tr = CASE name
    WHEN 'Erstberatung' THEN 'İlk Muayene'
    WHEN 'Kontrolluntersuchung' THEN 'Kontrol Muayenesi'
    WHEN 'Manuelle Therapie' THEN 'Manuel Terapi'
    WHEN 'Röntgenbesprechung' THEN 'Röntgen Değerlendirmesi'
    WHEN 'Injektionstherapie' THEN 'Enjeksiyon Tedavisi'
    ELSE name
  END;

-- =====================================================
-- 5. Startwerte: Versicherungsarten übersetzen
-- =====================================================

UPDATE insurance_types SET
  name_en = CASE name
    WHEN 'Gesetzlich versichert' THEN 'Public Insurance'
    WHEN 'Privat versichert' THEN 'Private Insurance'
    WHEN 'Selbstzahler' THEN 'Self-pay'
    ELSE name
  END,
  name_tr = CASE name
    WHEN 'Gesetzlich versichert' THEN 'Kamu Sigortası'
    WHEN 'Privat versichert' THEN 'Özel Sigorta'
    WHEN 'Selbstzahler' THEN 'Bireysel Ödeme'
    ELSE name
  END;
