-- =====================================================
-- Migration: Sa-Schedules verlängern (Jonda/Flores bis 15:00, Yilmaz bleibt 14:30)
-- =====================================================
-- Korrektur zu 20250423000022 nach User-Feedback:
--   Yilmaz Ercan: 08:00–14:30 (unverändert, passt zu existierenden Doctolib-Terminen)
--   Jonda + Flores: 08:00–15:00 (verlängert)
-- Zusätzlich 3 neue 10-Min-Slots pro Sa: 14:30, 14:40, 14:50.

-- 1. Schedules verlängern
UPDATE practitioner_schedules SET end_time = '15:00'::time
WHERE day_of_week = 6
  AND valid_from IN ('2026-05-30','2026-06-13','2026-06-27')
  AND practitioner_id IN (
    '2624228d-b3d1-4766-8577-6462e5b03b8b',  -- Flores
    '72ffd07b-9a13-4e8c-9006-1da30c8f566c'   -- Jonda
  );

-- 2. Neue Slots 14:30-15:00 (10-Min-Raster passend zum bestehenden 08:00-14:30)
INSERT INTO time_slots (date, start_time, end_time, is_available)
SELECT d::date, t::time, (t::time + interval '10 minutes')::time, true
FROM (VALUES ('2026-05-30'), ('2026-06-13'), ('2026-06-27')) AS dates(d)
CROSS JOIN (VALUES ('14:30'), ('14:40'), ('14:50')) AS times(t)
ON CONFLICT (date, start_time) DO NOTHING;

DO $$
DECLARE v_slots INTEGER; v_sched INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_slots FROM time_slots
   WHERE date IN ('2026-05-30','2026-06-13','2026-06-27');
  SELECT COUNT(*) INTO v_sched FROM practitioner_schedules
   WHERE day_of_week=6
     AND valid_from IN ('2026-05-30','2026-06-13','2026-06-27')
     AND end_time = '15:00'::time;
  RAISE NOTICE 'Sa-Slots total: % (erwartet 126: 3 × 42), Jonda+Flores 15:00-Schedules: % (erwartet 6)',
    v_slots, v_sched;
END $$;
