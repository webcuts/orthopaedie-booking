-- =====================================================
-- ORTHO-004: Datenbank-Schema Erweiterung
-- Behandler, Fachgebiete, Öffnungszeiten, Erinnerungen
-- =====================================================

-- =====================================================
-- Tabelle: specialties (Fachgebiete)
-- =====================================================
CREATE TABLE specialties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE specialties IS 'Medizinische Fachgebiete der Praxis';

-- =====================================================
-- Tabelle: practitioners (Behandler)
-- =====================================================
CREATE TABLE practitioners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    specialty_id UUID REFERENCES specialties(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    available_from DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practitioners_specialty ON practitioners(specialty_id);
CREATE INDEX idx_practitioners_active ON practitioners(is_active) WHERE is_active = true;

COMMENT ON TABLE practitioners IS 'Behandler/Ärzte der Praxis';

-- =====================================================
-- Tabelle: practice_hours (Öffnungszeiten)
-- =====================================================
CREATE TABLE practice_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_day UNIQUE (day_of_week),
    CONSTRAINT valid_hours CHECK (close_time > open_time OR is_closed = true)
);

COMMENT ON TABLE practice_hours IS 'Öffnungszeiten der Praxis (0=Montag, 6=Sonntag)';

-- =====================================================
-- Tabelle: email_reminders (Erinnerungs-Queue)
-- =====================================================
CREATE TYPE reminder_type AS ENUM ('24h_before', '6h_before');

CREATE TABLE email_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    reminder_type reminder_type NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_reminder UNIQUE (appointment_id, reminder_type)
);

CREATE INDEX idx_reminders_pending ON email_reminders(scheduled_for) WHERE sent_at IS NULL;
CREATE INDEX idx_reminders_appointment ON email_reminders(appointment_id);

COMMENT ON TABLE email_reminders IS 'Queue für E-Mail-Erinnerungen vor Terminen';

-- =====================================================
-- Appointments-Tabelle erweitern
-- =====================================================
ALTER TABLE appointments
    ADD COLUMN practitioner_id UUID REFERENCES practitioners(id),
    ADD COLUMN cancellation_deadline TIMESTAMPTZ;

CREATE INDEX idx_appointments_practitioner ON appointments(practitioner_id);

-- =====================================================
-- Row Level Security aktivieren
-- =====================================================
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_reminders ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies: Öffentlicher Lesezugriff
-- =====================================================

-- Specialties: Öffentlich lesbar
CREATE POLICY "specialties_public_read" ON specialties
    FOR SELECT
    USING (is_active = true);

-- Practitioners: Öffentlich lesbar (aktive, verfügbare)
CREATE POLICY "practitioners_public_read" ON practitioners
    FOR SELECT
    USING (is_active = true AND (available_from IS NULL OR available_from <= CURRENT_DATE));

-- Practice Hours: Öffentlich lesbar
CREATE POLICY "practice_hours_public_read" ON practice_hours
    FOR SELECT
    USING (true);

-- Email Reminders: Nur für authentifizierte Admins
-- (kein öffentlicher Zugriff)

-- =====================================================
-- RLS Policies: Admin-Zugriff
-- =====================================================

CREATE POLICY "specialties_admin_all" ON specialties
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "practitioners_admin_all" ON practitioners
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "practice_hours_admin_all" ON practice_hours
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "email_reminders_admin_all" ON email_reminders
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- Alte Daten bereinigen
-- =====================================================

-- Alte Behandlungsarten entfernen
DELETE FROM treatment_types;

-- Alte Versicherungsarten anpassen (Selbstzahler entfernen)
DELETE FROM insurance_types WHERE name = 'Selbstzahler';

-- =====================================================
-- Seed-Daten: Fachgebiete
-- =====================================================
INSERT INTO specialties (name, is_active) VALUES
    ('Orthopäde und Unfallchirurg', true),
    ('Physikalischer und Rehabilitativer Mediziner', true);

-- =====================================================
-- Seed-Daten: Behandler
-- =====================================================
INSERT INTO practitioners (title, first_name, last_name, specialty_id, is_active, available_from)
SELECT
    'Dr. med.',
    'Yilmaz',
    'Ercan',
    id,
    true,
    NULL
FROM specialties WHERE name = 'Orthopäde und Unfallchirurg';

INSERT INTO practitioners (title, first_name, last_name, specialty_id, is_active, available_from)
SELECT
    'Dr. med.',
    'Michael',
    'Jonda',
    id,
    true,
    NULL
FROM specialties WHERE name = 'Orthopäde und Unfallchirurg';

INSERT INTO practitioners (title, first_name, last_name, specialty_id, is_active, available_from)
SELECT
    NULL,
    'Vladimir',
    'Flores',
    id,
    true,
    NULL
FROM specialties WHERE name = 'Orthopäde und Unfallchirurg';

INSERT INTO practitioners (title, first_name, last_name, specialty_id, is_active, available_from)
SELECT
    NULL,
    'Yulia',
    'Namakonova',
    id,
    true,
    NULL
FROM specialties WHERE name = 'Physikalischer und Rehabilitativer Mediziner';

INSERT INTO practitioners (title, first_name, last_name, specialty_id, is_active, available_from)
SELECT
    NULL,
    'Jwan',
    'Mohammed',
    id,
    true,
    '2026-05-01'
FROM specialties WHERE name = 'Orthopäde und Unfallchirurg';

-- =====================================================
-- Seed-Daten: Öffnungszeiten
-- =====================================================
INSERT INTO practice_hours (day_of_week, open_time, close_time, is_closed) VALUES
    (0, '07:45', '17:30', false),  -- Montag
    (1, '07:45', '17:30', false),  -- Dienstag
    (2, '07:45', '12:30', false),  -- Mittwoch
    (3, '07:45', '17:30', false),  -- Donnerstag
    (4, '07:45', '16:45', false),  -- Freitag
    (5, '08:00', '15:00', false),  -- Samstag
    (6, '00:00', '00:00', true);   -- Sonntag (geschlossen)

-- =====================================================
-- Seed-Daten: Terminarten (aktualisiert)
-- =====================================================
INSERT INTO treatment_types (name, duration_minutes, description, is_active) VALUES
    ('Erstuntersuchung Neupatient', 15, 'Ersttermin für neue Patienten', true),
    ('Sprechstunde', 10, 'Kontrolltermin für Bestandspatienten', true),
    ('Rezepte', 5, 'Rezeptabholung', true);

-- =====================================================
-- Funktion: Cancellation Deadline automatisch setzen
-- =====================================================
CREATE OR REPLACE FUNCTION set_cancellation_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- Hole Datum und Zeit des Zeitslots
    SELECT
        (ts.date + ts.start_time) - INTERVAL '12 hours'
    INTO NEW.cancellation_deadline
    FROM time_slots ts
    WHERE ts.id = NEW.time_slot_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_cancellation_deadline
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION set_cancellation_deadline();

-- =====================================================
-- Funktion: E-Mail-Erinnerungen automatisch erstellen
-- =====================================================
CREATE OR REPLACE FUNCTION create_email_reminders()
RETURNS TRIGGER AS $$
DECLARE
    slot_datetime TIMESTAMPTZ;
BEGIN
    -- Hole Datum und Zeit des Zeitslots
    SELECT
        (ts.date + ts.start_time)::TIMESTAMPTZ
    INTO slot_datetime
    FROM time_slots ts
    WHERE ts.id = NEW.time_slot_id;

    -- 24h Erinnerung erstellen
    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for)
    VALUES (NEW.id, '24h_before', slot_datetime - INTERVAL '24 hours');

    -- 6h Erinnerung erstellen
    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for)
    VALUES (NEW.id, '6h_before', slot_datetime - INTERVAL '6 hours');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_email_reminders
    AFTER INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_email_reminders();
