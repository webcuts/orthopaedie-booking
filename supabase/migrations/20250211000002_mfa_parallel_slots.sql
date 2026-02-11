-- =====================================================
-- ORTHO-027: MFA Parallelslots
-- Separate Booking Track für MFA-Leistungen
-- =====================================================

-- =====================================================
-- 1. Neue Tabelle: mfa_treatment_types
-- =====================================================
CREATE TABLE mfa_treatment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    name_tr TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mfa_treatment_types IS 'MFA-Leistungen (Praxisleistungen ohne Arzt)';

-- Seed-Daten
INSERT INTO mfa_treatment_types (name, name_en, name_tr, duration_minutes, sort_order) VALUES
    ('Rezeptvergabe', 'Prescription', 'Reçete', 5, 1),
    ('Medikamente', 'Medication', 'İlaç', 5, 2);

-- =====================================================
-- 2. Neue Tabelle: mfa_time_slots
-- =====================================================
CREATE TABLE mfa_time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_parallel INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_mfa_date_start_time UNIQUE (date, start_time)
);

CREATE INDEX idx_mfa_time_slots_date ON mfa_time_slots (date);
CREATE INDEX idx_mfa_time_slots_date_time ON mfa_time_slots (date, start_time);

COMMENT ON TABLE mfa_time_slots IS 'Zeitslots für MFA-Leistungen (parallel buchbar)';

-- =====================================================
-- 3. Neue Tabelle: mfa_appointments
-- =====================================================
CREATE TABLE mfa_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    mfa_treatment_type_id UUID NOT NULL REFERENCES mfa_treatment_types(id),
    mfa_time_slot_id UUID NOT NULL REFERENCES mfa_time_slots(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    notes TEXT,
    cancel_token UUID DEFAULT gen_random_uuid(),
    consent_given BOOLEAN NOT NULL DEFAULT false,
    consent_timestamp TIMESTAMPTZ,
    booked_by TEXT NOT NULL DEFAULT 'patient',
    language TEXT DEFAULT 'de',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mfa_appointments_slot ON mfa_appointments (mfa_time_slot_id);
CREATE INDEX idx_mfa_appointments_patient ON mfa_appointments (patient_id);
CREATE INDEX idx_mfa_appointments_status ON mfa_appointments (status);
CREATE INDEX idx_mfa_appointments_cancel_token ON mfa_appointments (cancel_token);

COMMENT ON TABLE mfa_appointments IS 'Buchungen für MFA-Leistungen (parallel zu Arztterminen)';

-- =====================================================
-- 4. Kapazitätsprüfung
-- =====================================================
CREATE OR REPLACE FUNCTION check_mfa_slot_availability(p_slot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT (
        SELECT COUNT(*)
        FROM mfa_appointments
        WHERE mfa_time_slot_id = p_slot_id
          AND status != 'cancelled'
    ) < (
        SELECT max_parallel
        FROM mfa_time_slots
        WHERE id = p_slot_id
    );
$$;

GRANT EXECUTE ON FUNCTION check_mfa_slot_availability(UUID) TO anon;
GRANT EXECUTE ON FUNCTION check_mfa_slot_availability(UUID) TO authenticated;

-- =====================================================
-- 5. MFA Slot-Generator
-- =====================================================
CREATE OR REPLACE FUNCTION generate_mfa_time_slots(weeks_ahead INTEGER DEFAULT 4)
RETURNS TABLE (
    slots_created INTEGER,
    period_start DATE,
    period_end DATE
) AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    end_date DATE := CURRENT_DATE + (weeks_ahead * 7);
    processing_date DATE;
    current_day_of_week INTEGER;
    practice_open TIME;
    practice_close TIME;
    practice_lunch_start TIME;
    practice_lunch_end TIME;
    is_day_closed BOOLEAN;
    slot_start TIME;
    slot_end TIME;
    created_count INTEGER := 0;
    slot_duration INTERVAL := '10 minutes';
BEGIN
    processing_date := current_date;

    WHILE processing_date <= end_date LOOP
        current_day_of_week := EXTRACT(ISODOW FROM processing_date) - 1;

        -- Hole Öffnungszeiten für diesen Wochentag
        SELECT
            ph.open_time,
            ph.close_time,
            ph.lunch_start,
            ph.lunch_end,
            ph.is_closed
        INTO
            practice_open,
            practice_close,
            practice_lunch_start,
            practice_lunch_end,
            is_day_closed
        FROM practice_hours ph
        WHERE ph.day_of_week = current_day_of_week;

        IF NOT is_day_closed AND practice_open IS NOT NULL THEN
            -- Runde Öffnungszeit auf nächste 10 Minuten
            slot_start := (
                DATE_TRUNC('hour', TIMESTAMP '2000-01-01' + practice_open) +
                INTERVAL '1 minute' * (CEIL(EXTRACT(MINUTE FROM practice_open) / 10.0) * 10)
            )::TIME;

            IF EXTRACT(MINUTE FROM slot_start) = 60 THEN
                slot_start := (TIMESTAMP '2000-01-01' + slot_start + INTERVAL '1 hour' - INTERVAL '60 minutes')::TIME;
            END IF;

            -- Generiere MFA-Slots bis zur Schließzeit
            WHILE slot_start + slot_duration <= practice_close LOOP
                slot_end := slot_start + slot_duration;

                -- Überspringe Mittagspause
                IF practice_lunch_start IS NOT NULL AND practice_lunch_end IS NOT NULL
                   AND slot_start >= practice_lunch_start AND slot_start < practice_lunch_end THEN
                    slot_start := practice_lunch_end;
                    CONTINUE;
                END IF;

                INSERT INTO mfa_time_slots (date, start_time, end_time, max_parallel)
                VALUES (processing_date, slot_start, slot_end, 2)
                ON CONFLICT (date, start_time) DO NOTHING;

                IF FOUND THEN
                    created_count := created_count + 1;
                END IF;

                slot_start := slot_end;
            END LOOP;
        END IF;

        processing_date := processing_date + 1;
    END LOOP;

    slots_created := created_count;
    period_start := current_date;
    period_end := end_date;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_mfa_time_slots IS 'Generiert MFA-Zeitslots basierend auf practice_hours';

-- =====================================================
-- 6. Rate Limiting erweitern (zählt beide Buchungstypen)
-- =====================================================
CREATE OR REPLACE FUNCTION check_booking_rate_limit(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT (
        (SELECT COUNT(*) FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE p.email = p_email
           AND a.created_at > NOW() - INTERVAL '24 hours')
        +
        (SELECT COUNT(*) FROM mfa_appointments ma
         JOIN patients p ON ma.patient_id = p.id
         WHERE p.email = p_email
           AND ma.created_at > NOW() - INTERVAL '24 hours')
    ) < 3;
$$;

-- =====================================================
-- 7. RLS Policies
-- =====================================================

-- mfa_treatment_types: Öffentlich lesbar (aktive), Authenticated voll
ALTER TABLE mfa_treatment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_treatment_types_public_read" ON mfa_treatment_types
    FOR SELECT
    USING (is_active = true);

CREATE POLICY "mfa_treatment_types_admin_all" ON mfa_treatment_types
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- mfa_time_slots: Öffentlich lesbar, Authenticated voll
ALTER TABLE mfa_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_time_slots_public_read" ON mfa_time_slots
    FOR SELECT
    USING (true);

CREATE POLICY "mfa_time_slots_admin_all" ON mfa_time_slots
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- mfa_appointments: Anon kann einfügen und lesen, Authenticated voll
ALTER TABLE mfa_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_appointments_anon_insert" ON mfa_appointments
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "mfa_appointments_anon_select" ON mfa_appointments
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "mfa_appointments_admin_all" ON mfa_appointments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 8. E-Mail-Erinnerungen für MFA erweitern
-- =====================================================

-- booking_type hinzufügen (doctor/mfa)
ALTER TABLE email_reminders ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'doctor';

-- FK-Constraint entfernen (MFA-IDs können nicht in appointments referenziert werden)
ALTER TABLE email_reminders DROP CONSTRAINT IF EXISTS email_reminders_appointment_id_fkey;

-- Unique-Constraint anpassen (appointment_id + reminder_type + booking_type)
ALTER TABLE email_reminders DROP CONSTRAINT IF EXISTS unique_reminder;
ALTER TABLE email_reminders ADD CONSTRAINT unique_reminder
    UNIQUE (appointment_id, reminder_type, booking_type);

-- Trigger für MFA-Erinnerungen
CREATE OR REPLACE FUNCTION create_mfa_email_reminders()
RETURNS TRIGGER AS $$
DECLARE
    slot_datetime TIMESTAMPTZ;
BEGIN
    SELECT
        (ts.date + ts.start_time)::TIMESTAMPTZ
    INTO slot_datetime
    FROM mfa_time_slots ts
    WHERE ts.id = NEW.mfa_time_slot_id;

    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for, booking_type)
    VALUES (NEW.id, '24h_before', slot_datetime - INTERVAL '24 hours', 'mfa');

    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for, booking_type)
    VALUES (NEW.id, '6h_before', slot_datetime - INTERVAL '6 hours', 'mfa');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_mfa_email_reminders
    AFTER INSERT ON mfa_appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_mfa_email_reminders();

-- =====================================================
-- 9. Initiale MFA-Slots generieren (4 Wochen)
-- =====================================================
SELECT * FROM generate_mfa_time_slots(4);
