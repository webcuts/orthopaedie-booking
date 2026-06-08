-- =====================================================
-- Migration: Flores Fr-Schedule end_time von 15:45 → 15:50
-- =====================================================
-- User-Wunsch: letzter buchbarer Termin um 15:40 (= Slot 15:40–15:50).
-- end_time=15:50 macht das in Filter-Logik (slot.start < schedule.end) eindeutig.

UPDATE practitioner_schedules
SET end_time = '15:50'::time
WHERE practitioner_id = '2624228d-b3d1-4766-8577-6462e5b03b8b'
  AND day_of_week = 5
  AND valid_from = '2026-04-27'
  AND valid_until IS NULL
  AND end_time = '15:45'::time;

DO $$
DECLARE v_end TIME;
BEGIN
  SELECT end_time INTO v_end FROM practitioner_schedules
  WHERE practitioner_id='2624228d-b3d1-4766-8577-6462e5b03b8b'
    AND day_of_week=5 AND valid_until IS NULL;
  RAISE NOTICE 'Flores Fr end_time: % (erwartet 15:50:00)', v_end;
END $$;
