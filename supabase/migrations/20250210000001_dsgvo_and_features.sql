-- =====================================================
-- Migration: DSGVO, Stornierung, Monitoring, Cron
-- Tickets: DSGVO Compliance, Stornierungslink,
--          Fehlerbehandlung/Monitoring, Auto-Slot-Cron
-- =====================================================

-- 1. DSGVO: Consent-Felder für Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;

-- 2. Stornierung: Cancel-Token für Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_appointments_cancel_token ON appointments(cancel_token);

-- 3. DSGVO: Anonymisierungsfunktion für Patientendaten
CREATE OR REPLACE FUNCTION anonymize_patient(p_patient_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE patients SET
    name = 'Gelöscht',
    email = 'geloescht-' || p_patient_id || '@anonymized.local',
    phone = NULL
  WHERE id = p_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Monitoring: System-Logs Tabelle
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(event_type);

-- RLS für system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Admins can read logs'
  ) THEN
    CREATE POLICY "Admins can read logs" ON system_logs FOR SELECT
      TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'System can insert logs'
  ) THEN
    CREATE POLICY "System can insert logs" ON system_logs FOR INSERT
      TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

-- 5. Cron: Wöchentliche automatische Slot-Generierung
-- Montag um 02:00 Uhr, 4 Wochen voraus
-- HINWEIS: pg_cron muss als Extension aktiviert sein
-- Falls pg_cron nicht verfügbar, kann dieser Block übersprungen werden
DO $outer$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'weekly-slot-generation',
      '0 2 * * 1',
      $$SELECT generate_time_slots_with_log(4, 'cron_job')$$
    );
  END IF;
END $outer$;
