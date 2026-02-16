-- =====================================================
-- MFA Email Reminder Trigger
-- Erstellt automatisch 24h- und 6h-Erinnerungen
-- bei neuen MFA-Terminen und löscht sie bei Stornierung.
-- =====================================================

-- 1. Sicherstellen dass FK auf email_reminders.appointment_id entfernt ist
--    (MFA-Appointment-IDs existieren nicht in appointments)
ALTER TABLE email_reminders DROP CONSTRAINT IF EXISTS email_reminders_appointment_id_fkey;

-- 2. Sicherstellen dass unique_reminder booking_type enthält
ALTER TABLE email_reminders DROP CONSTRAINT IF EXISTS unique_reminder;
ALTER TABLE email_reminders ADD CONSTRAINT unique_reminder
    UNIQUE (appointment_id, reminder_type, booking_type);

-- 3. Trigger-Funktion: Erstellt Erinnerungen bei neuem MFA-Termin
CREATE OR REPLACE FUNCTION create_mfa_email_reminders()
RETURNS TRIGGER AS $$
DECLARE
    slot_datetime TIMESTAMPTZ;
BEGIN
    -- Nur bei confirmed-Status Reminders erstellen
    IF NEW.status != 'confirmed' THEN
        RETURN NEW;
    END IF;

    SELECT (ts.date + ts.start_time)::TIMESTAMPTZ
    INTO slot_datetime
    FROM mfa_time_slots ts
    WHERE ts.id = NEW.mfa_time_slot_id;

    -- 24h-Erinnerung
    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for, booking_type)
    VALUES (NEW.id, '24h_before', slot_datetime - INTERVAL '24 hours', 'mfa')
    ON CONFLICT (appointment_id, reminder_type, booking_type) DO NOTHING;

    -- 6h-Erinnerung
    INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for, booking_type)
    VALUES (NEW.id, '6h_before', slot_datetime - INTERVAL '6 hours', 'mfa')
    ON CONFLICT (appointment_id, reminder_type, booking_type) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger-Funktion: Löscht Erinnerungen bei Stornierung
CREATE OR REPLACE FUNCTION cancel_mfa_email_reminders()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        DELETE FROM email_reminders
        WHERE appointment_id = NEW.id
          AND booking_type = 'mfa'
          AND sent_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger erstellen (DROP zuerst für Idempotenz)
DROP TRIGGER IF EXISTS trigger_create_mfa_email_reminders ON mfa_appointments;
CREATE TRIGGER trigger_create_mfa_email_reminders
    AFTER INSERT ON mfa_appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_mfa_email_reminders();

DROP TRIGGER IF EXISTS trigger_cancel_mfa_email_reminders ON mfa_appointments;
CREATE TRIGGER trigger_cancel_mfa_email_reminders
    AFTER UPDATE ON mfa_appointments
    FOR EACH ROW
    EXECUTE FUNCTION cancel_mfa_email_reminders();
