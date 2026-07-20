-- =====================================================
-- Restore: Ercan + Mohammed Do/Fr laut Praxis-Website
-- =====================================================
-- Ercan Do: Offene Sprechstunde 09:00-14:30 (nicht online buchbar)
-- Ercan Fr: Sprechstunde 13:30-16:00 (online buchbar, kein Vormittag)
-- Mohammed Do + Fr: analog Mo/Di (09-12 + 12:30-16:30)

-- Alte falsche Ercan-Einträge (versehentlich als Vormittag/Nachmittag angelegt) raus
DELETE FROM practitioner_schedules
WHERE practitioner_id='97827ec6-aa35-4d8e-8bec-25ded48c23ca'
  AND day_of_week IN (4,5)
  AND label IN ('Sprechstunde Vormittag','Sprechstunde Nachmittag')
  AND valid_until IS NULL;

INSERT INTO practitioner_schedules
  (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
SELECT * FROM (VALUES
  -- Ercan
  ('97827ec6-aa35-4d8e-8bec-25ded48c23ca'::uuid, 4, '09:00'::time, '14:30'::time, false, 'all', 'Offene Sprechstunde', CURRENT_DATE, NULL::date),
  ('97827ec6-aa35-4d8e-8bec-25ded48c23ca'::uuid, 5, '13:30'::time, '16:00'::time, true,  'all', 'Sprechstunde',         CURRENT_DATE, NULL::date),
  -- Mohammed Do
  ('b68e4305-2a6a-404a-bd88-e94058f8929a'::uuid, 4, '09:00'::time, '12:00'::time, true, 'all', 'Sprechstunde Vormittag',   CURRENT_DATE, NULL::date),
  ('b68e4305-2a6a-404a-bd88-e94058f8929a'::uuid, 4, '12:30'::time, '16:30'::time, true, 'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL::date),
  -- Mohammed Fr
  ('b68e4305-2a6a-404a-bd88-e94058f8929a'::uuid, 5, '09:00'::time, '12:00'::time, true, 'all', 'Sprechstunde Vormittag',   CURRENT_DATE, NULL::date),
  ('b68e4305-2a6a-404a-bd88-e94058f8929a'::uuid, 5, '12:30'::time, '16:30'::time, true, 'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL::date)
) AS v(practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
WHERE NOT EXISTS (
  SELECT 1 FROM practitioner_schedules ps
  WHERE ps.practitioner_id = v.practitioner_id
    AND ps.day_of_week = v.day_of_week
    AND ps.start_time = v.start_time
    AND ps.end_time = v.end_time
    AND (ps.valid_until IS NULL OR ps.valid_until >= CURRENT_DATE)
);
