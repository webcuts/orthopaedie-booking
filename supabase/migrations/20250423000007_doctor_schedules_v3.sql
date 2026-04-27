-- =====================================================
-- Sprechzeiten-Update April 2026:
-- - Dr. Ercan: Mi-Label korrigieren
-- - Dr. Jonda: vollständige Schedules
-- - Vladimir Flores: vollständige Schedules + Mi-Wechsel (kurz/lang)
-- - Dr. Namakonova: Sicherheits-Default + 16.05. als ersten Anwesenheitstag
-- =====================================================

DO $$
DECLARE
  v_ercan UUID;
  v_jonda UUID;
  v_flores UUID;
  v_yulia UUID;
  v_long_wed DATE;
BEGIN
  SELECT id INTO v_ercan  FROM practitioners WHERE last_name = 'Ercan'      LIMIT 1;
  SELECT id INTO v_jonda  FROM practitioners WHERE last_name = 'Jonda'      LIMIT 1;
  SELECT id INTO v_flores FROM practitioners WHERE last_name = 'Flores'     LIMIT 1;
  SELECT id INTO v_yulia  FROM practitioners WHERE last_name = 'Namakonova' LIMIT 1;

  -- ===== Dr. Ercan: nur Mi-Label umbenennen =====
  UPDATE practitioner_schedules
  SET label = 'Geschlossen'
  WHERE practitioner_id = v_ercan
    AND day_of_week = 3
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

  -- ===== Dr. Jonda: bestehende Schedules beenden, neue anlegen =====
  UPDATE practitioner_schedules
  SET valid_until = CURRENT_DATE - INTERVAL '1 day'
  WHERE practitioner_id = v_jonda
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

  INSERT INTO practitioner_schedules
    (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
  VALUES
    (v_jonda, 1, '08:30', '17:00', true, 'all', 'Sprechstunde', CURRENT_DATE, NULL),
    (v_jonda, 2, '08:30', '17:00', true, 'all', 'Sprechstunde', CURRENT_DATE, NULL),
    (v_jonda, 3, '08:30', '12:30', true, 'all', 'Sprechstunde', CURRENT_DATE, NULL),
    (v_jonda, 4, '08:30', '12:00', true, 'all', 'Sprechstunde Vormittag', CURRENT_DATE, NULL),
    (v_jonda, 4, '14:00', '17:00', true, 'all', 'Sprechstunde Nachmittag', CURRENT_DATE, NULL),
    (v_jonda, 5, '08:30', '12:30', true, 'all', 'Sprechstunde', CURRENT_DATE, NULL);

  -- ===== Vladimir Flores: bestehende beenden, Default + Mi-Lang-Overrides =====
  UPDATE practitioner_schedules
  SET valid_until = CURRENT_DATE - INTERVAL '1 day'
  WHERE practitioner_id = v_flores
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

  INSERT INTO practitioner_schedules
    (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
  VALUES
    (v_flores, 1, '09:00', '16:00', true, 'all', 'Sprechstunde',           CURRENT_DATE, NULL),
    (v_flores, 2, '09:00', '16:00', true, 'all', 'Sprechstunde',           CURRENT_DATE, NULL),
    (v_flores, 3, '09:00', '12:30', true, 'all', 'Sprechstunde Mi (kurz)', CURRENT_DATE, NULL),
    (v_flores, 4, '09:00', '16:00', true, 'all', 'Sprechstunde',           CURRENT_DATE, NULL),
    (v_flores, 5, '09:00', '15:45', true, 'all', 'Sprechstunde',           CURRENT_DATE, NULL);

  -- Mi-Lang-Overrides (zusätzlich 12:30-15:30 buchbar)
  -- Pattern: alle 14 Tage ab 29.04.2026
  FOR v_long_wed IN
    SELECT generate_series('2026-04-29'::date, '2026-12-23'::date, '14 days'::interval)::date
  LOOP
    INSERT INTO practitioner_schedules
      (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
    VALUES
      (v_flores, 3, '12:30', '15:30', true, 'all', 'Sprechstunde Mi (lang) Erweiterung', v_long_wed, v_long_wed);
  END LOOP;

  -- ===== Yulia Namakonova: sichtbar machen + Sicherheits-Defaults + 16.05. =====
  UPDATE practitioners SET available_from = NULL WHERE id = v_yulia;

  -- Bestehende Schedules räumen (sollte keine geben)
  UPDATE practitioner_schedules
  SET valid_until = CURRENT_DATE - INTERVAL '1 day'
  WHERE practitioner_id = v_yulia
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

  -- Default-Sperr-Schedules: alle Wochentage 00:00-23:59 NICHT buchbar
  -- (greift in Phase-2-Filter: schedules vorhanden → strikt; keine bookable matches → 0 Slots)
  INSERT INTO practitioner_schedules
    (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
  VALUES
    (v_yulia, 0, '00:00', '23:59', false, 'all', 'Nicht vor Ort', CURRENT_DATE, NULL),
    (v_yulia, 1, '00:00', '23:59', false, 'all', 'Nicht vor Ort', CURRENT_DATE, NULL),
    (v_yulia, 2, '00:00', '23:59', false, 'all', 'Nicht vor Ort', CURRENT_DATE, NULL),
    (v_yulia, 3, '00:00', '23:59', false, 'all', 'Nicht vor Ort', CURRENT_DATE, NULL),
    (v_yulia, 4, '00:00', '23:59', false, 'all', 'Nicht vor Ort', CURRENT_DATE, NULL),
    (v_yulia, 5, '00:00', '23:59', false, 'all', 'Nicht vor Ort', CURRENT_DATE, NULL),
    (v_yulia, 6, '00:00', '23:59', false, 'all', 'Nicht vor Ort', CURRENT_DATE, NULL);

  -- Anwesenheitstag 16.05.2026 (Sa) 08:00-13:00 buchbar
  INSERT INTO practitioner_schedules
    (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
  VALUES
    (v_yulia, 6, '08:00', '13:00', true, 'all', 'Anwesenheit', '2026-05-16', '2026-05-16');
END $$;

-- Kontrollabfrage
SELECT 'Schedules nach Update:' AS info;
SELECT p.last_name, ps.day_of_week,
       to_char(ps.start_time, 'HH24:MI') || '-' || to_char(ps.end_time, 'HH24:MI') AS zeit,
       ps.is_bookable, ps.label,
       ps.valid_from, ps.valid_until
FROM practitioner_schedules ps
JOIN practitioners p ON p.id = ps.practitioner_id
WHERE (ps.valid_until IS NULL OR ps.valid_until >= CURRENT_DATE)
ORDER BY p.last_name, ps.day_of_week, ps.start_time
LIMIT 50;
