-- =====================================================
-- Migration: Sa-Sprechstunden H2 2026 nach Papier-Liste ergänzen
-- =====================================================
-- Ergänzt alle fehlenden Behandler-Schedules + generiert Slots für
-- 6 Sa an denen noch keine Slots existieren.
--
-- Papier-Liste "SAMSTAGSSPRECHSTUNDEN 2026":
--   04.07: Jonda, Namakonova       (bereits eingetragen)
--   25.07: Flores, Namakonova      (bereits eingetragen)
--   01.08: Namakonova, Flores      (Flores fehlte)
--   22.08: Flores, Jonda           (komplett neu — keine Slots)
--   05.09: Flores, Jonda, Mohammed (komplett neu — keine Slots)
--   19.09: Flores, Jonda, Mohammed (komplett neu — keine Slots)
--   10.10: Flores, Jonda           (komplett neu — keine Slots)
--   24.10: Jonda, Mohammed         (Namakonova war drin, jetzt + Jonda + Mohammed)
--   07.11: Flores, Jonda           (Namakonova war drin, jetzt + Flores + Jonda)
--   21.11: Flores, Jonda           (komplett neu — keine Slots)
--   05.12: Flores, Jonda           (komplett neu — keine Slots)
--   19.12: Flores, Jonda           (Namakonova war drin, jetzt + Flores + Jonda)

-- =====================================================
-- 1. Jwan Mohammed reaktivieren (war archiviert; steht wieder auf Liste)
-- =====================================================
UPDATE practitioners SET is_active = true
WHERE id = 'b68e4305-2a6a-404a-bd88-e94058f8929a' AND is_active = false;

-- =====================================================
-- 2. Fehlende Time-Slots für 6 Sa generieren (08:00-14:50, 42 Slots/Tag)
-- =====================================================
INSERT INTO time_slots (date, start_time, end_time, is_available)
SELECT
  d::date,
  (TIME '08:00' + (g * interval '10 minutes'))::time,
  (TIME '08:00' + ((g + 1) * interval '10 minutes'))::time,
  true
FROM (VALUES
  ('2026-08-22'), ('2026-09-05'), ('2026-09-19'),
  ('2026-10-10'), ('2026-11-21'), ('2026-12-05')
) AS dates(d)
CROSS JOIN generate_series(0, 41) AS g
ON CONFLICT (date, start_time) DO NOTHING;

-- =====================================================
-- 3. Fehlende Behandler-Schedules einfügen
-- =====================================================
-- day_of_week=6 (Sa nach JS getDay), 08:00-15:00, bookable, valid_from=valid_until=Sa

WITH neu(practitioner_id, sa_datum) AS (VALUES
  -- 01.08: Flores fehlt
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-08-01'::date),
  -- 22.08: Flores + Jonda
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-08-22'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-08-22'::date),
  -- 05.09: Flores + Jonda + Mohammed
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-09-05'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-09-05'::date),
  ('b68e4305-2a6a-404a-bd88-e94058f8929a'::uuid, '2026-09-05'::date),
  -- 19.09: Flores + Jonda + Mohammed
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-09-19'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-09-19'::date),
  ('b68e4305-2a6a-404a-bd88-e94058f8929a'::uuid, '2026-09-19'::date),
  -- 10.10: Flores + Jonda
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-10-10'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-10-10'::date),
  -- 24.10: Jonda + Mohammed
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-10-24'::date),
  ('b68e4305-2a6a-404a-bd88-e94058f8929a'::uuid, '2026-10-24'::date),
  -- 07.11: Flores + Jonda
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-11-07'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-11-07'::date),
  -- 21.11: Flores + Jonda
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-11-21'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-11-21'::date),
  -- 05.12: Flores + Jonda
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-12-05'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-12-05'::date),
  -- 19.12: Flores + Jonda
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, '2026-12-19'::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, '2026-12-19'::date)
)
INSERT INTO practitioner_schedules
  (practitioner_id, day_of_week, start_time, end_time, is_bookable,
   insurance_filter, label, valid_from, valid_until)
SELECT n.practitioner_id, 6, '08:00'::time, '15:00'::time, true,
       'all', 'Sa-Sprechstunde', n.sa_datum, n.sa_datum
FROM neu n
WHERE NOT EXISTS (
  SELECT 1 FROM practitioner_schedules ps
  WHERE ps.practitioner_id = n.practitioner_id
    AND ps.day_of_week = 6
    AND ps.valid_from = n.sa_datum
    AND ps.valid_until = n.sa_datum
);

-- =====================================================
-- 4. Verifikation
-- =====================================================
DO $$
DECLARE
  v_slots_created INT;
  v_schedules_total INT;
BEGIN
  SELECT COUNT(*) INTO v_slots_created FROM time_slots
   WHERE date IN ('2026-08-22','2026-09-05','2026-09-19','2026-10-10','2026-11-21','2026-12-05');

  SELECT COUNT(*) INTO v_schedules_total FROM practitioner_schedules
   WHERE day_of_week=6
     AND valid_from IN ('2026-07-04','2026-07-25','2026-08-01','2026-08-22','2026-09-05',
                        '2026-09-19','2026-10-10','2026-10-24','2026-11-07','2026-11-21',
                        '2026-12-05','2026-12-19');

  RAISE NOTICE 'Sa-Slots (6 neue Sa × 42): % (erwartet mind. 252)', v_slots_created;
  RAISE NOTICE 'Sa-Schedules H2 total: %', v_schedules_total;
END $$;
