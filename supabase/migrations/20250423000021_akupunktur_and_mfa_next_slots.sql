-- =====================================================
-- Migration: Akupunktur als MFA-Leistung + RPC "nächste freie MFA-Slots"
-- =====================================================

-- 1. Akupunktur einfügen (analog zu PRP/Hyaluron: behandlung, nicht patient-visible)
INSERT INTO mfa_treatment_types (
  name, name_en, name_tr, name_ru, name_ar, name_es,
  duration_minutes, is_active, sort_order,
  specialty_id, patient_visible, follow_up_count
)
SELECT
  'Akupunktur', 'Acupuncture', 'Akupunktur', 'Иглоукалывание', 'الوخز بالإبر', 'Acupuntura',
  10, true, 7,
  '43039593-69bb-4cd1-ac17-234d9138f60c',
  false, 0
WHERE NOT EXISTS (
  SELECT 1 FROM mfa_treatment_types WHERE LOWER(name) = 'akupunktur'
);

-- 2. RPC: Nächste N freie MFA-Slots (für Schnellauswahl im Admin-Modal)
-- Verfügbarkeit: COUNT(active appointments) < max_parallel
-- Ab Berliner Zeit "jetzt" (heute keine vergangenen Slots)
CREATE OR REPLACE FUNCTION get_next_admin_mfa_slots(
  p_count INTEGER DEFAULT 4,
  p_after_date DATE DEFAULT CURRENT_DATE,
  p_after_time TIME DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  date DATE,
  start_time TIME,
  end_time TIME
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT p_after_date AS d,
           COALESCE(p_after_time, (NOW() AT TIME ZONE 'Europe/Berlin')::time) AS t
  ),
  bookings AS (
    SELECT mfa_time_slot_id, COUNT(*) AS booked
    FROM mfa_appointments
    WHERE status <> 'cancelled'
    GROUP BY mfa_time_slot_id
  )
  SELECT ts.id, ts.date, ts.start_time, ts.end_time
  FROM mfa_time_slots ts
  CROSS JOIN params
  LEFT JOIN bookings b ON b.mfa_time_slot_id = ts.id
  WHERE ts.date >= params.d
    AND (ts.date > params.d OR ts.start_time > params.t)
    AND COALESCE(b.booked, 0) < ts.max_parallel
  ORDER BY ts.date, ts.start_time
  LIMIT p_count;
$$;

GRANT EXECUTE ON FUNCTION get_next_admin_mfa_slots(INTEGER, DATE, TIME) TO authenticated;

-- 3. pg_cron Job: MFA-Slots täglich 18 Wochen voraus generieren
-- (analog zum bestehenden auto-generate-time-slots für Arzttermine, 15 Min versetzt)
-- Idempotent: ON CONFLICT DO NOTHING im generate_mfa_time_slots.
SELECT cron.unschedule('auto-generate-mfa-slots')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto-generate-mfa-slots');
SELECT cron.schedule(
  'auto-generate-mfa-slots',
  '15 2 * * *',
  $$SELECT generate_mfa_time_slots(18);$$
);

-- 4. Initial-Generation falls in der DB nur veraltete Slots stehen
SELECT generate_mfa_time_slots(18);

-- 5. Verifikation
DO $$
DECLARE v INTEGER;
BEGIN
  SELECT COUNT(*) INTO v FROM mfa_treatment_types WHERE LOWER(name)='akupunktur';
  RAISE NOTICE 'Akupunktur-Einträge: %', v;
END $$;
