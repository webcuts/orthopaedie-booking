-- =====================================================
-- Migration: Magnetfeld als MFA-Leistung
-- =====================================================
-- Analog zu Akupunktur (Mig 21): Behandlung, 10 Min, nicht patient-visible

INSERT INTO mfa_treatment_types (
  name, name_en, name_tr, name_ru, name_ar, name_es,
  duration_minutes, is_active, sort_order,
  specialty_id, patient_visible, follow_up_count
)
SELECT
  'Magnetfeld', 'Magnetic Field Therapy', 'Manyetik Alan Tedavisi',
  'Магнитотерапия', 'العلاج بالمجال المغناطيسي', 'Magnetoterapia',
  10, true, 8,
  '43039593-69bb-4cd1-ac17-234d9138f60c',
  false, 0
WHERE NOT EXISTS (
  SELECT 1 FROM mfa_treatment_types WHERE LOWER(name) = 'magnetfeld'
);

DO $$
DECLARE v INT;
BEGIN
  SELECT COUNT(*) INTO v FROM mfa_treatment_types WHERE LOWER(name)='magnetfeld';
  RAISE NOTICE 'Magnetfeld-Einträge: %', v;
END $$;
