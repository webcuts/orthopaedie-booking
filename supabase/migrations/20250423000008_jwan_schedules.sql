-- =====================================================
-- Sprechzeiten Jwan Mohammed (final von Dietmar)
-- Mo/Di/Do/Fr: 08:00-12:00 + 12:30-16:30 buchbar (Pause 12-12:30)
-- Mi:          08:00-12:30 buchbar + 13:00-16:30 OP (nicht buchbar)
-- =====================================================

DO $$
DECLARE
  v_jwan UUID;
BEGIN
  SELECT id INTO v_jwan FROM practitioners WHERE last_name = 'Mohammed' LIMIT 1;
  IF v_jwan IS NULL THEN
    RAISE NOTICE 'Jwan Mohammed not found';
    RETURN;
  END IF;

  -- Falls bereits Schedules existieren: alte beenden
  UPDATE practitioner_schedules
  SET valid_until = CURRENT_DATE - INTERVAL '1 day'
  WHERE practitioner_id = v_jwan
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

  INSERT INTO practitioner_schedules
    (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
  VALUES
    -- Montag (1)
    (v_jwan, 1, '08:00', '12:00', true,  'all', 'Sprechstunde Vormittag',  CURRENT_DATE, NULL),
    (v_jwan, 1, '12:30', '16:30', true,  'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL),
    -- Dienstag (2)
    (v_jwan, 2, '08:00', '12:00', true,  'all', 'Sprechstunde Vormittag',  CURRENT_DATE, NULL),
    (v_jwan, 2, '12:30', '16:30', true,  'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL),
    -- Mittwoch (3): OP-Nachmittag, nicht buchbar
    (v_jwan, 3, '08:00', '12:30', true,  'all', 'Sprechstunde',            CURRENT_DATE, NULL),
    (v_jwan, 3, '13:00', '16:30', false, 'all', 'OP-Tag',                  CURRENT_DATE, NULL),
    -- Donnerstag (4)
    (v_jwan, 4, '08:00', '12:00', true,  'all', 'Sprechstunde Vormittag',  CURRENT_DATE, NULL),
    (v_jwan, 4, '12:30', '16:30', true,  'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL),
    -- Freitag (5)
    (v_jwan, 5, '08:00', '12:00', true,  'all', 'Sprechstunde Vormittag',  CURRENT_DATE, NULL),
    (v_jwan, 5, '12:30', '16:30', true,  'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL);
END $$;

-- Kontrolle
SELECT day_of_week,
       to_char(start_time, 'HH24:MI') || '-' || to_char(end_time, 'HH24:MI') AS zeit,
       is_bookable, label
FROM practitioner_schedules
WHERE practitioner_id = (SELECT id FROM practitioners WHERE last_name = 'Mohammed')
  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
ORDER BY day_of_week, start_time;
