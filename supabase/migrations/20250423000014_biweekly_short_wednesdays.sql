-- =====================================================
-- Migration: Zweiwöchentliche verkürzte Mittwoche
-- =====================================================
-- Ab Mi 20.05.2026 alle 14 Tage: nach 10:50 keine Termine mehr buchbar
-- (Cutoff 11:00 → der 10:50-Slot ist der letzte buchbare, alles ab 11:00 wird gesperrt)

-- 1. Tabelle für verkürzte Praxistage
CREATE TABLE IF NOT EXISTS short_practice_days (
  date DATE PRIMARY KEY,
  cutoff_time TIME NOT NULL DEFAULT '11:00:00',
  reason TEXT
);

-- 2. Daten: Mi 20.05.2026 + alle 14 Tage bis 31.12.2028
INSERT INTO short_practice_days (date, cutoff_time, reason)
SELECT d::date, '11:00:00', 'Verkürzter Mittwoch (zweiwöchentlich)'
FROM generate_series('2026-05-20'::date, '2028-12-31'::date, '14 days'::interval) d
ON CONFLICT (date) DO NOTHING;

-- 3. Bestehende Slots blocken (alle Slots ab Cutoff)
UPDATE time_slots ts
SET is_available = false
FROM short_practice_days spd
WHERE ts.date = spd.date AND ts.start_time >= spd.cutoff_time;

-- 4. Cron-Job erweitern: nach jedem Slot-Generation-Run die kurzen Tage erneut blocken
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'auto-generate-time-slots';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'auto-generate-time-slots',
  '0 2 * * *',
  $$
  SELECT generate_time_slots_with_log(18, 'cron_auto');
  UPDATE time_slots ts SET is_available = false
  FROM short_practice_days spd
  WHERE ts.date = spd.date AND ts.start_time >= spd.cutoff_time AND ts.is_available = true;
  $$
);

-- 5. Verifikation
DO $$
DECLARE
  v_days INTEGER;
  v_blocked INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_days FROM short_practice_days WHERE date >= CURRENT_DATE;
  SELECT COUNT(*) INTO v_blocked
  FROM time_slots ts
  JOIN short_practice_days spd ON spd.date = ts.date
  WHERE ts.start_time >= spd.cutoff_time AND ts.is_available = false;

  RAISE NOTICE 'Verkürzte Tage in Zukunft: %, davon Slots blockiert: %', v_days, v_blocked;
END $$;
