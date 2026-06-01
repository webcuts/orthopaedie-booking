-- =====================================================
-- Migration: Sprechzeiten Yulia Namakonova Jun–Dez 2026
-- 08:00–13:00 an 12 einzelnen Tagen (Sa + Mo gemischt)
-- =====================================================
-- DB-Konvention day_of_week: JS getDay() = 0=So,1=Mo,…,6=Sa
-- (CHECK constraint day_of_week BETWEEN 0 AND 6 bestätigt das)

WITH dates(d) AS (VALUES
  ('2026-06-13'::date), -- Sa
  ('2026-06-20'::date), -- Sa
  ('2026-07-04'::date), -- Sa
  ('2026-07-25'::date), -- Sa
  ('2026-08-01'::date), -- Sa
  ('2026-08-03'::date), -- Mo
  ('2026-09-14'::date), -- Mo
  ('2026-10-24'::date), -- Sa
  ('2026-10-26'::date), -- Mo
  ('2026-11-07'::date), -- Sa
  ('2026-11-09'::date), -- Mo
  ('2026-12-19'::date)  -- Sa
),
yulia AS (
  SELECT id FROM practitioners WHERE last_name='Namakonova' AND is_active=true LIMIT 1
)
-- 1. Schedules (eines pro Datum, day_of_week aus EXTRACT(DOW) → 0..6)
INSERT INTO practitioner_schedules
  (practitioner_id, day_of_week, start_time, end_time,
   is_bookable, insurance_filter, label, valid_from, valid_until)
SELECT
  yulia.id,
  EXTRACT(DOW FROM dates.d)::int,
  '08:00'::time, '13:00'::time,
  true, 'all', 'Sprechstunde',
  dates.d, dates.d
FROM dates CROSS JOIN yulia
WHERE NOT EXISTS (
  SELECT 1 FROM practitioner_schedules ps
  WHERE ps.practitioner_id = yulia.id
    AND ps.valid_from = dates.d
    AND ps.valid_until = dates.d
);

-- 2. Time-Slots (10-Min-Raster 08:00–12:50 = 30 Slots pro Tag)
INSERT INTO time_slots (date, start_time, end_time, is_available)
SELECT
  d::date,
  (TIME '08:00' + (g * interval '10 minutes'))::time,
  (TIME '08:00' + ((g + 1) * interval '10 minutes'))::time,
  true
FROM (VALUES
  ('2026-06-13'), ('2026-06-20'),
  ('2026-07-04'), ('2026-07-25'),
  ('2026-08-01'), ('2026-08-03'),
  ('2026-09-14'),
  ('2026-10-24'), ('2026-10-26'),
  ('2026-11-07'), ('2026-11-09'),
  ('2026-12-19')
) AS dates(d)
CROSS JOIN generate_series(0, 29) AS g
ON CONFLICT (date, start_time) DO NOTHING;

-- 3. Verifikation
DO $$
DECLARE v_sched INT; v_slots INT;
BEGIN
  SELECT COUNT(*) INTO v_sched FROM practitioner_schedules ps
  JOIN practitioners pr ON pr.id=ps.practitioner_id
  WHERE pr.last_name='Namakonova'
    AND ps.valid_from BETWEEN '2026-06-01' AND '2026-12-31'
    AND ps.start_time='08:00'::time AND ps.end_time='13:00'::time;

  SELECT COUNT(*) INTO v_slots FROM time_slots
  WHERE date IN ('2026-06-13','2026-06-20','2026-07-04','2026-07-25',
                 '2026-08-01','2026-08-03','2026-09-14','2026-10-24',
                 '2026-10-26','2026-11-07','2026-11-09','2026-12-19')
    AND start_time >= '08:00'::time AND start_time < '13:00'::time;

  RAISE NOTICE 'Yulia Sprechzeiten: % Schedules (erwartet 12), % Slots (erwartet 360 = 12 × 30)',
    v_sched, v_slots;
END $$;
