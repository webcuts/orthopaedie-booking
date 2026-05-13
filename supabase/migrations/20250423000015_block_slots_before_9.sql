-- =====================================================
-- Migration: Slots vor 09:00 nicht online buchbar
-- =====================================================
-- Vor 09:00 finden Notfall-Sprechstunden statt — keine Online-Buchung erlaubt.
-- Bestehende gebuchte Termine vor 09:00 (z.B. aus Doctolib-Import) bleiben unverändert.

-- 1. Bestehende freie Slots vor 09:00 blockieren (außer wo aktive Buchung existiert)
UPDATE time_slots ts
SET is_available = false
WHERE ts.start_time < '09:00:00'
  AND ts.is_available = true
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.time_slot_id = ts.id AND a.status <> 'cancelled'
  );

-- 2. Cron-Job erweitern: nach Slot-Generierung pre-09:00 wieder blocken
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
  -- Kurze Mittwoche blocken
  UPDATE time_slots ts SET is_available = false
  FROM short_practice_days spd
  WHERE ts.date = spd.date AND ts.start_time >= spd.cutoff_time AND ts.is_available = true;
  -- Slots vor 09:00 blocken (Notfall-Sprechstunden, nicht online buchbar)
  UPDATE time_slots ts SET is_available = false
  WHERE ts.start_time < '09:00:00' AND ts.is_available = true
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.time_slot_id = ts.id AND a.status <> 'cancelled'
    );
  $$
);

-- 3. Verifikation
DO $$
DECLARE
  v_blocked INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_blocked
  FROM time_slots ts
  WHERE ts.start_time < '09:00:00' AND ts.is_available = false
    AND ts.date >= CURRENT_DATE;
  RAISE NOTICE 'Slots vor 09:00 ab heute blockiert: %', v_blocked;
END $$;
