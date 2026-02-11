-- =====================================================
-- Neue Öffnungszeiten mit Mittagspause
-- Mo, Di, Do: 07:45-12:30 & 13:00-17:30
-- Mi: 07:30-12:30
-- Fr: 07:45-12:30 & 13:00-16:30
-- Sa + So: geschlossen
-- =====================================================

-- 1. Mittagspause-Spalten hinzufügen
ALTER TABLE practice_hours
  ADD COLUMN IF NOT EXISTS lunch_start TIME,
  ADD COLUMN IF NOT EXISTS lunch_end TIME;

-- 2. Öffnungszeiten aktualisieren
UPDATE practice_hours SET open_time = '07:45', close_time = '17:30', lunch_start = '12:30', lunch_end = '13:00', is_closed = false WHERE day_of_week = 0; -- Montag
UPDATE practice_hours SET open_time = '07:45', close_time = '17:30', lunch_start = '12:30', lunch_end = '13:00', is_closed = false WHERE day_of_week = 1; -- Dienstag
UPDATE practice_hours SET open_time = '07:30', close_time = '12:30', lunch_start = NULL, lunch_end = NULL, is_closed = false WHERE day_of_week = 2; -- Mittwoch
UPDATE practice_hours SET open_time = '07:45', close_time = '17:30', lunch_start = '12:30', lunch_end = '13:00', is_closed = false WHERE day_of_week = 3; -- Donnerstag
UPDATE practice_hours SET open_time = '07:45', close_time = '16:30', lunch_start = '12:30', lunch_end = '13:00', is_closed = false WHERE day_of_week = 4; -- Freitag
UPDATE practice_hours SET is_closed = true, open_time = '00:00', close_time = '00:01', lunch_start = NULL, lunch_end = NULL WHERE day_of_week = 5; -- Samstag
-- Sonntag bleibt geschlossen (day_of_week = 6)

-- 3. Slot-Generator mit Mittagspause aktualisieren
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
            -- Runde Öffnungszeit auf nächste 10 Minuten auf
            slot_start := (
                DATE_TRUNC('hour', TIMESTAMP '2000-01-01' + practice_open) +
                INTERVAL '1 minute' * (CEIL(EXTRACT(MINUTE FROM practice_open) / 10.0) * 10)
            )::TIME;

            IF EXTRACT(MINUTE FROM slot_start) = 60 THEN
                slot_start := (TIMESTAMP '2000-01-01' + slot_start + INTERVAL '1 hour' - INTERVAL '60 minutes')::TIME;
            END IF;

            -- Generiere Slots bis zur Schließzeit
            WHILE slot_start + slot_duration <= practice_close LOOP
                slot_end := slot_start + slot_duration;

                -- Überspringe Mittagspause
                IF practice_lunch_start IS NOT NULL AND practice_lunch_end IS NOT NULL
                   AND slot_start >= practice_lunch_start AND slot_start < practice_lunch_end THEN
                    slot_start := practice_lunch_end;
                    CONTINUE;
                END IF;

                INSERT INTO time_slots (date, start_time, end_time, is_available)
                VALUES (processing_date, slot_start, slot_end, true)
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

-- 4. Bestehende Mittagspause-Slots für Zukunft entfernen
-- Lösche verfügbare (nicht gebuchte) Slots in der Mittagspause für zukünftige Tage
DELETE FROM time_slots
WHERE date >= CURRENT_DATE
  AND is_available = true
  AND start_time >= '12:30'
  AND start_time < '13:00'
  AND EXTRACT(ISODOW FROM date) IN (1, 2, 4, 5); -- Mo, Di, Do, Fr

-- 5. Samstag-Slots für Zukunft entfernen (Samstag jetzt geschlossen)
DELETE FROM time_slots
WHERE date >= CURRENT_DATE
  AND is_available = true
  AND EXTRACT(ISODOW FROM date) = 6; -- Samstag
