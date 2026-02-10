-- =====================================================
-- ORTHO-007: Trigger-Funktionen mit SECURITY DEFINER
--
-- Fix: Alle Trigger die in RLS-geschützte Tabellen
-- schreiben, müssen SECURITY DEFINER verwenden, damit
-- sie unabhängig vom aufrufenden User (anon) funktionieren.
--
-- Hauptproblem: create_email_reminders() versuchte als
-- anon-User in email_reminders zu schreiben → RLS-Fehler
-- → gesamte Buchung schlug fehl.
-- =====================================================

-- 1. E-Mail-Erinnerungen erstellen (CRITICAL FIX)
CREATE OR REPLACE FUNCTION create_email_reminders()
RETURNS TRIGGER AS $$
DECLARE
    slot_datetime TIMESTAMPTZ;
BEGIN
    SELECT
        (ts.date + ts.start_time)::TIMESTAMPTZ
    INTO slot_datetime
    FROM time_slots ts
    WHERE ts.id = NEW.time_slot_id;

    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for)
    VALUES (NEW.id, '24h_before', slot_datetime - INTERVAL '24 hours');

    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for)
    VALUES (NEW.id, '6h_before', slot_datetime - INTERVAL '6 hours');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Cancellation Deadline setzen
CREATE OR REPLACE FUNCTION set_cancellation_deadline()
RETURNS TRIGGER AS $$
BEGIN
    SELECT
        (ts.date + ts.start_time) - INTERVAL '12 hours'
    INTO NEW.cancellation_deadline
    FROM time_slots ts
    WHERE ts.id = NEW.time_slot_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Slot blockieren bei Buchung
CREATE OR REPLACE FUNCTION block_slot_on_booking()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE time_slots
    SET is_available = false
    WHERE id = NEW.time_slot_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Slot freigeben bei Stornierung
CREATE OR REPLACE FUNCTION unblock_slot_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        UPDATE time_slots
        SET is_available = true
        WHERE id = NEW.time_slot_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
