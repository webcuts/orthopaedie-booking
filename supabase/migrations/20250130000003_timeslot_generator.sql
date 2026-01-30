-- =====================================================
-- ORTHO-008: Zeitslot-Generator
-- Automatische Generierung von Zeitslots basierend auf Öffnungszeiten
-- =====================================================

-- =====================================================
-- Unique Constraint für time_slots
-- Verhindert doppelte Slots am gleichen Tag/Uhrzeit
-- =====================================================
ALTER TABLE time_slots
ADD CONSTRAINT unique_date_start_time UNIQUE (date, start_time);

-- =====================================================
-- Funktion: generate_time_slots
-- Generiert Zeitslots für X Wochen im Voraus
-- =====================================================
CREATE OR REPLACE FUNCTION generate_time_slots(weeks_ahead INTEGER DEFAULT 4)
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
    is_day_closed BOOLEAN;
    slot_start TIME;
    slot_end TIME;
    created_count INTEGER := 0;
    slot_duration INTERVAL := '10 minutes';
BEGIN
    -- Iteriere durch jeden Tag im Zeitraum
    processing_date := current_date;

    WHILE processing_date <= end_date LOOP
        -- Bestimme Wochentag (0=Montag, 6=Sonntag in PostgreSQL: EXTRACT gibt 1=Mo, 7=So)
        -- Konvertiere zu unserem Format (0=Montag, 6=Sonntag)
        current_day_of_week := EXTRACT(ISODOW FROM processing_date) - 1;

        -- Hole Öffnungszeiten für diesen Wochentag
        SELECT
            ph.open_time,
            ph.close_time,
            ph.is_closed
        INTO
            practice_open,
            practice_close,
            is_day_closed
        FROM practice_hours ph
        WHERE ph.day_of_week = current_day_of_week;

        -- Wenn Tag nicht geschlossen ist
        IF NOT is_day_closed AND practice_open IS NOT NULL THEN
            -- Runde Öffnungszeit auf nächste 10 Minuten auf
            -- z.B. 07:45 -> 07:50, 08:00 -> 08:00
            slot_start := (
                DATE_TRUNC('hour', TIMESTAMP '2000-01-01' + practice_open) +
                INTERVAL '1 minute' * (CEIL(EXTRACT(MINUTE FROM practice_open) / 10.0) * 10)
            )::TIME;

            -- Wenn die Minuten genau 60 werden, zur nächsten Stunde
            IF EXTRACT(MINUTE FROM slot_start) = 60 THEN
                slot_start := (TIMESTAMP '2000-01-01' + slot_start + INTERVAL '1 hour' - INTERVAL '60 minutes')::TIME;
            END IF;

            -- Generiere Slots bis zur Schließzeit
            WHILE slot_start + slot_duration <= practice_close LOOP
                slot_end := slot_start + slot_duration;

                -- Insert mit ON CONFLICT DO NOTHING (keine Duplikate)
                INSERT INTO time_slots (date, start_time, end_time, is_available)
                VALUES (processing_date, slot_start, slot_end, true)
                ON CONFLICT (date, start_time) DO NOTHING;

                -- Zähle nur wenn tatsächlich eingefügt
                IF FOUND THEN
                    created_count := created_count + 1;
                END IF;

                -- Nächster Slot
                slot_start := slot_end;
            END LOOP;
        END IF;

        -- Nächster Tag
        processing_date := processing_date + 1;
    END LOOP;

    -- Rückgabe
    slots_created := created_count;
    period_start := current_date;
    period_end := end_date;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_time_slots IS 'Generiert Zeitslots basierend auf practice_hours für X Wochen im Voraus';

-- =====================================================
-- Logging-Tabelle für Slot-Generierung
-- =====================================================
CREATE TABLE IF NOT EXISTS slot_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    weeks_ahead INTEGER NOT NULL,
    slots_created INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    triggered_by TEXT DEFAULT 'manual'
);

COMMENT ON TABLE slot_generation_logs IS 'Protokoll der Zeitslot-Generierungen';

-- RLS für Logging-Tabelle
ALTER TABLE slot_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slot_generation_logs_admin_all" ON slot_generation_logs
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Öffentlich lesbar für Debugging
CREATE POLICY "slot_generation_logs_public_read" ON slot_generation_logs
    FOR SELECT
    USING (true);

-- =====================================================
-- Wrapper-Funktion mit Logging
-- =====================================================
CREATE OR REPLACE FUNCTION generate_time_slots_with_log(
    weeks_ahead INTEGER DEFAULT 4,
    triggered_by TEXT DEFAULT 'manual'
)
RETURNS TABLE (
    success BOOLEAN,
    slots_created INTEGER,
    period TEXT
) AS $$
DECLARE
    result RECORD;
BEGIN
    -- Führe Slot-Generierung aus
    SELECT * INTO result FROM generate_time_slots(weeks_ahead);

    -- Logge Ausführung
    INSERT INTO slot_generation_logs (weeks_ahead, slots_created, period_start, period_end, triggered_by)
    VALUES (weeks_ahead, result.slots_created, result.period_start, result.period_end, triggered_by);

    -- Rückgabe
    success := true;
    slots_created := result.slots_created;
    period := TO_CHAR(result.period_start, 'DD.MM.YYYY') || ' - ' || TO_CHAR(result.period_end, 'DD.MM.YYYY');

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_time_slots_with_log IS 'Generiert Zeitslots und protokolliert die Ausführung';
