-- =====================================================
-- Restore: Do/Fr Schedules für Jonda + Flores wurden versehentlich
-- über die Admin-UI gelöscht. Werte aus Migration 07 + 27 rekonstruiert.
-- =====================================================

INSERT INTO practitioner_schedules
  (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
SELECT * FROM (VALUES
  -- Jonda Do (Vormittag + Nachmittag)
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, 4, '08:30'::time, '12:00'::time, true, 'all', 'Sprechstunde Vormittag', CURRENT_DATE, NULL::date),
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, 4, '14:00'::time, '17:00'::time, true, 'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL::date),
  -- Jonda Fr
  ('72ffd07b-9a13-4e8c-9006-1da30c8f566c'::uuid, 5, '08:30'::time, '12:30'::time, true, 'all', 'Sprechstunde', CURRENT_DATE, NULL::date),
  -- Flores Do
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, 4, '09:00'::time, '16:00'::time, true, 'all', 'Sprechstunde', CURRENT_DATE, NULL::date),
  -- Flores Fr (Endzeit 15:50 aus Mig 27)
  ('2624228d-b3d1-4766-8577-6462e5b03b8b'::uuid, 5, '09:00'::time, '15:50'::time, true, 'all', 'Sprechstunde', CURRENT_DATE, NULL::date)
) AS v(practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
WHERE NOT EXISTS (
  SELECT 1 FROM practitioner_schedules ps
  WHERE ps.practitioner_id = v.practitioner_id
    AND ps.day_of_week = v.day_of_week
    AND ps.start_time = v.start_time
    AND ps.end_time = v.end_time
    AND (ps.valid_until IS NULL OR ps.valid_until >= CURRENT_DATE)
);
