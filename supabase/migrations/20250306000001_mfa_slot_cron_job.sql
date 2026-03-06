-- Bugfix: Automatische MFA-Slot-Generierung per pg_cron
-- Sonntag 02:15 Uhr, 4 Wochen voraus (kurz nach dem Arzt-Slot-Job Montag 02:00)
DO $outer$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'weekly-mfa-slot-generation',
      '15 2 * * 0',
      $$SELECT generate_mfa_time_slots(4)$$
    );
  END IF;
END $outer$;
