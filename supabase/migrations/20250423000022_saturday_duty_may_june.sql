-- =====================================================
-- Migration: Samstagsdienst 30.05 / 13.06 / 27.06 — Schedules für Ercan/Jonda/Flores
-- =====================================================
-- Ohne Sa-Schedules filtert der Frontend-Schedule-Filter (useSupabase.ts)
-- die Sa-Tage für Jonda + Flores raus → Patienten sehen keine Sa-Termine,
-- obwohl die Slots existieren. Drei Sa-spezifische Schedules pro Behandler
-- (valid_from = valid_until = das Sa-Datum) machen sie buchbar.
--
-- Ercan: bekommt den Schedule der Konsistenz halber, ist aber durch seine
-- 39 Doctolib-Termine bereits voll → 0 freie Slots → Patienten sehen ihn
-- an diesen Sa nicht (korrekt).
--
-- Zeitfenster: 08:00–14:30 (passend zu den bereits existierenden 39 Slots/Sa).

WITH dates(d) AS (VALUES
  ('2026-05-30'::date),
  ('2026-06-13'::date),
  ('2026-06-27'::date)
),
prac(id, name) AS (VALUES
  ('97827ec6-aa35-4d8e-8bec-25ded48c23ca'::uuid, 'Ercan'),
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, 'Flores'),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, 'Jonda')
)
INSERT INTO practitioner_schedules
  (practitioner_id, day_of_week, start_time, end_time, is_bookable, valid_from, valid_until)
SELECT p.id, 6, '08:00'::time, '14:30'::time, true, d.d, d.d
FROM prac p CROSS JOIN dates d
WHERE NOT EXISTS (
  SELECT 1 FROM practitioner_schedules ps
  WHERE ps.practitioner_id = p.id
    AND ps.day_of_week = 6
    AND ps.valid_from = d.d
    AND ps.valid_until = d.d
);

DO $$
DECLARE v INTEGER;
BEGIN
  SELECT COUNT(*) INTO v FROM practitioner_schedules
  WHERE day_of_week=6 AND valid_from IN ('2026-05-30','2026-06-13','2026-06-27');
  RAISE NOTICE 'Sa-Schedules total: % (erwartet: 9)', v;
END $$;
