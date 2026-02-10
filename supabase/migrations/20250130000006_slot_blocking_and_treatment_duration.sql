-- =====================================================
-- ORTHO-006: Behandlungszeiten auf 10 Min, Slot-Blockierung
-- bei Buchung via Trigger, Race-Condition-Schutz
-- =====================================================

-- =====================================================
-- 1. Alle Behandlungszeiten auf 10 Minuten setzen
-- =====================================================
UPDATE treatment_types SET duration_minutes = 10;

-- =====================================================
-- 2. Trigger: Slot blockieren bei Buchung (INSERT)
-- =====================================================
CREATE OR REPLACE FUNCTION block_slot_on_booking()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE time_slots
    SET is_available = false
    WHERE id = NEW.time_slot_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_block_slot_on_booking
    AFTER INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION block_slot_on_booking();

-- =====================================================
-- 3. Trigger: Slot freigeben bei Stornierung (UPDATE)
-- =====================================================
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unblock_slot_on_cancel
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION unblock_slot_on_cancel();

-- =====================================================
-- 4. Race-Condition-Schutz: Partial Unique Index
--    Ersetzt den bisherigen UNIQUE Constraint, damit
--    stornierte Termine den Slot nicht blockieren
-- =====================================================

-- Bestehenden UNIQUE Constraint entfernen
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS unique_time_slot;

-- Partial Unique Index: Nur aktive Termine blockieren den Slot
CREATE UNIQUE INDEX idx_unique_active_booking
    ON appointments(time_slot_id)
    WHERE status != 'cancelled';
