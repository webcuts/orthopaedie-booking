-- =====================================================
-- Migration: Ercan Schedules — nur tatsächlich online buchbare Zeiten markieren
-- =====================================================
-- Aktuell waren Di, Do und mehrere überlappende Fr-Slots fälschlich
-- als is_bookable=true markiert. Online buchbar sind aber nur:
--   Mo 13:30-16:30
--   Fr 13:30-16:00
-- Di + Do = Offene Sprechstunde (Walk-in, nicht online)

UPDATE practitioner_schedules
SET is_bookable = false
WHERE practitioner_id = (SELECT id FROM practitioners WHERE last_name = 'Ercan')
  AND is_bookable = true
  AND NOT (
    (day_of_week = 1 AND start_time = '13:30' AND end_time = '16:30')
    OR (day_of_week = 5 AND start_time = '13:30' AND end_time = '16:00')
  );

-- Verifikation
DO $$
DECLARE
  v_bookable_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bookable_count
  FROM practitioner_schedules ps
  JOIN practitioners pr ON pr.id = ps.practitioner_id
  WHERE pr.last_name = 'Ercan' AND ps.is_bookable = true;

  IF v_bookable_count <> 2 THEN
    RAISE WARNING 'Erwartete 2 buchbare Schedule-Einträge für Ercan, gefunden: %', v_bookable_count;
  ELSE
    RAISE NOTICE 'Ercan: 2 buchbare Schedules (Mo 13:30-16:30 + Fr 13:30-16:00)';
  END IF;
END $$;
