-- =====================================================
-- Behandler-Abwesenheiten (Urlaub, Krankheit etc.)
-- =====================================================

-- Enum für Abwesenheitsgrund
CREATE TYPE absence_reason AS ENUM ('sick', 'vacation', 'other');

-- Tabelle: practitioner_absences
CREATE TABLE IF NOT EXISTS practitioner_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason absence_reason NOT NULL DEFAULT 'other',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraint: end_date muss >= start_date sein
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Index für schnelle Abfragen
CREATE INDEX idx_practitioner_absences_practitioner ON practitioner_absences(practitioner_id);
CREATE INDEX idx_practitioner_absences_dates ON practitioner_absences(start_date, end_date);

-- RLS aktivieren
ALTER TABLE practitioner_absences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authentifizierte Benutzer haben vollen Zugriff
CREATE POLICY "Authenticated users have full access to absences"
  ON practitioner_absences FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anonyme können aktive Abwesenheiten sehen (für Booking-Widget)
CREATE POLICY "Anon can view active absences"
  ON practitioner_absences FOR SELECT
  TO anon
  USING (
    start_date <= CURRENT_DATE + INTERVAL '90 days'
    AND end_date >= CURRENT_DATE
  );

-- =====================================================
-- Funktion: Termine bei Abwesenheit stornieren
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_appointments_for_absence()
RETURNS TRIGGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Finde und storniere alle betroffenen Termine
  UPDATE appointments
  SET
    status = 'cancelled',
    notes = COALESCE(notes, '') || E'\n[Automatisch storniert: Behandler abwesend]'
  WHERE
    practitioner_id = NEW.practitioner_id
    AND status IN ('pending', 'confirmed')
    AND time_slot_id IN (
      SELECT id FROM time_slots
      WHERE date >= NEW.start_date
      AND date <= NEW.end_date
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  -- Log
  RAISE NOTICE 'Abwesenheit eingetragen: % Termine storniert für Behandler %',
    affected_count, NEW.practitioner_id;

  -- Zeitslots wieder freigeben
  UPDATE time_slots
  SET is_available = true
  WHERE id IN (
    SELECT time_slot_id FROM appointments
    WHERE practitioner_id = NEW.practitioner_id
    AND status = 'cancelled'
    AND time_slot_id IN (
      SELECT id FROM time_slots
      WHERE date >= NEW.start_date
      AND date <= NEW.end_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Bei neuer Abwesenheit Termine stornieren
DROP TRIGGER IF EXISTS trigger_cancel_appointments_on_absence ON practitioner_absences;
CREATE TRIGGER trigger_cancel_appointments_on_absence
  AFTER INSERT ON practitioner_absences
  FOR EACH ROW
  EXECUTE FUNCTION cancel_appointments_for_absence();

-- =====================================================
-- View: Aktive Abwesenheiten mit Behandler-Info
-- =====================================================

CREATE OR REPLACE VIEW active_absences AS
SELECT
  pa.id,
  pa.practitioner_id,
  p.title,
  p.first_name,
  p.last_name,
  pa.start_date,
  pa.end_date,
  pa.reason,
  pa.note,
  pa.created_at,
  (pa.end_date - pa.start_date + 1) as duration_days
FROM practitioner_absences pa
JOIN practitioners p ON pa.practitioner_id = p.id
WHERE pa.end_date >= CURRENT_DATE
ORDER BY pa.start_date;

-- =====================================================
-- Funktion: Prüfen ob Behandler abwesend ist
-- =====================================================

CREATE OR REPLACE FUNCTION is_practitioner_absent(
  p_practitioner_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM practitioner_absences
    WHERE practitioner_id = p_practitioner_id
    AND p_date BETWEEN start_date AND end_date
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Kommentar zur Tabelle
COMMENT ON TABLE practitioner_absences IS 'Speichert Abwesenheitszeiten von Behandlern (Urlaub, Krankheit etc.)';
COMMENT ON COLUMN practitioner_absences.reason IS 'sick = Krankheit, vacation = Urlaub, other = Sonstiges';
