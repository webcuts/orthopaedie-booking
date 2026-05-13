-- =====================================================
-- Migration: pg_cron Auto-Slot-Generation
-- =====================================================
-- Ziel: Slots sind IMMER 4 Monate (18 Wochen) im Voraus buchbar
-- Mechanik: pg_cron läuft täglich nachts und füllt Slots auf

-- Extension aktivieren (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Bestehenden Job (falls vorhanden) entfernen, damit re-running idempotent ist
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'auto-generate-time-slots';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Cron-Job: Täglich um 03:00 Berliner Zeit (01:00 UTC im Sommer, 02:00 UTC im Winter)
-- Wir nutzen 02:00 UTC = 03:00 oder 04:00 lokal — Tageszeit ohne Last
-- Die Funktion ist idempotent (ON CONFLICT DO NOTHING in time_slots), also
-- tägliches Aufrufen schadet nicht und stellt sicher dass nie eine Lücke entsteht
SELECT cron.schedule(
  'auto-generate-time-slots',
  '0 2 * * *',  -- täglich um 02:00 UTC
  $$SELECT generate_time_slots_with_log(18, 'cron_auto');$$
);

-- Initial-Run: sofort 18 Wochen Slots erzeugen damit der Stand jetzt schon korrekt ist
SELECT generate_time_slots_with_log(18, 'cron_setup');

-- Verifikation
DO $$
DECLARE
  v_max_date DATE;
  v_target_date DATE;
  v_job_exists BOOLEAN;
BEGIN
  SELECT MAX(date) INTO v_max_date FROM time_slots;
  v_target_date := CURRENT_DATE + INTERVAL '17 weeks';

  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'auto-generate-time-slots')
    INTO v_job_exists;

  IF NOT v_job_exists THEN
    RAISE EXCEPTION 'Migration fehlgeschlagen: cron job wurde nicht angelegt';
  END IF;

  IF v_max_date < v_target_date THEN
    RAISE WARNING 'Slots reichen nur bis %, erwartet mindestens %', v_max_date, v_target_date;
  END IF;

  RAISE NOTICE 'Cron-Job aktiv. Slots vorhanden bis: %', v_max_date;
END $$;
