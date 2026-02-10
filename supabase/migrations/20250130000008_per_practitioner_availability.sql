-- =====================================================
-- ORTHO-008: Verfügbarkeit pro Behandler (dynamisch)
--
-- Bisher: Slot wird global blockiert (is_available=false)
-- Jetzt: Verfügbarkeit pro Behandler dynamisch berechnet
--        is_available bleibt nur für generelle Sperren
-- =====================================================

-- =====================================================
-- 1. Slot-Blocking-Triggers entfernen
-- =====================================================
DROP TRIGGER IF EXISTS trigger_block_slot_on_booking ON appointments;
DROP TRIGGER IF EXISTS trigger_unblock_slot_on_cancel ON appointments;
DROP FUNCTION IF EXISTS block_slot_on_booking();
DROP FUNCTION IF EXISTS unblock_slot_on_cancel();

-- =====================================================
-- 2. Gebuchte Slots wieder freigeben
--    (waren durch den alten Trigger blockiert)
-- =====================================================
UPDATE time_slots
SET is_available = true
WHERE is_available = false
  AND id IN (
    SELECT time_slot_id FROM appointments
    WHERE status != 'cancelled'
  );

-- =====================================================
-- 3. UNIQUE Constraint: pro Behandler statt global
--    Erlaubt: gleicher Slot, verschiedene Behandler
--    Verhindert: gleicher Slot + gleicher Behandler
-- =====================================================
DROP INDEX IF EXISTS idx_unique_active_booking;

CREATE UNIQUE INDEX idx_unique_active_booking
    ON appointments(time_slot_id, practitioner_id)
    WHERE status != 'cancelled';

-- Separater Index für Buchungen ohne Behandler (practitioner_id IS NULL)
-- Verhindert mehrfache NULL-Behandler-Buchungen auf demselben Slot
CREATE UNIQUE INDEX idx_unique_active_booking_no_practitioner
    ON appointments(time_slot_id)
    WHERE status != 'cancelled' AND practitioner_id IS NULL;

-- =====================================================
-- 4. RPC: Verfügbare Slots für Datum + Behandler
-- =====================================================
CREATE OR REPLACE FUNCTION get_available_slots(
    p_date DATE,
    p_practitioner_id UUID DEFAULT NULL
)
RETURNS SETOF time_slots AS $$
BEGIN
    IF p_practitioner_id IS NOT NULL THEN
        -- Slots die für diesen Behandler noch frei sind
        RETURN QUERY
        SELECT ts.*
        FROM time_slots ts
        WHERE ts.date = p_date
          AND ts.is_available = true
          AND NOT EXISTS (
              SELECT 1 FROM appointments a
              WHERE a.time_slot_id = ts.id
                AND a.practitioner_id = p_practitioner_id
                AND a.status != 'cancelled'
          )
        ORDER BY ts.start_time;
    ELSE
        -- Ohne Behandler-Filter: alle verfügbaren Slots
        RETURN QUERY
        SELECT ts.*
        FROM time_slots ts
        WHERE ts.date = p_date
          AND ts.is_available = true
        ORDER BY ts.start_time;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 5. RPC: Verfügbare Tage für Monat + Behandler
-- =====================================================
CREATE OR REPLACE FUNCTION get_available_dates(
    p_start_date DATE,
    p_end_date DATE,
    p_practitioner_id UUID DEFAULT NULL
)
RETURNS TABLE(date DATE) AS $$
BEGIN
    IF p_practitioner_id IS NOT NULL THEN
        RETURN QUERY
        SELECT DISTINCT ts.date
        FROM time_slots ts
        WHERE ts.date >= p_start_date
          AND ts.date <= p_end_date
          AND ts.is_available = true
          AND NOT EXISTS (
              SELECT 1 FROM appointments a
              WHERE a.time_slot_id = ts.id
                AND a.practitioner_id = p_practitioner_id
                AND a.status != 'cancelled'
          )
        ORDER BY ts.date;
    ELSE
        RETURN QUERY
        SELECT DISTINCT ts.date
        FROM time_slots ts
        WHERE ts.date >= p_start_date
          AND ts.date <= p_end_date
          AND ts.is_available = true
        ORDER BY ts.date;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
