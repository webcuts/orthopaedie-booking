-- =====================================================
-- Migration: RPCs für schedule-aware Slot-Suche im Admin-Panel
-- =====================================================
-- Bisheriger get_available_slots prüft nur is_available + Existenz von Appointments
-- — ignoriert practitioner_schedules. MFA bekam Slots an Mi (Ercan zu) oder vor 09:00.
--
-- Zwei neue RPCs:
--   1. get_admin_available_slots — alle Slots eines Tages die wirklich buchbar sind
--   2. get_next_admin_slots — die nächsten N buchbaren Slots (für "Nächster freier Termin")

-- =====================================================
-- 1. get_admin_available_slots: alle Slots eines Tages, schedule-aware
-- =====================================================
CREATE OR REPLACE FUNCTION get_admin_available_slots(
  p_date DATE,
  p_practitioner_id UUID
)
RETURNS SETOF time_slots
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ts.*
  FROM time_slots ts
  WHERE ts.date = p_date
    AND ts.is_available = true
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.time_slot_id = ts.id
        AND a.practitioner_id = p_practitioner_id
        AND a.status <> 'cancelled'
    )
    AND EXISTS (
      SELECT 1 FROM practitioner_schedules ps
      WHERE ps.practitioner_id = p_practitioner_id
        AND ps.is_bookable = true
        AND ps.day_of_week = EXTRACT(ISODOW FROM ts.date)
        AND ts.start_time >= GREATEST(ps.start_time, TIME '09:00')
        AND ts.start_time < ps.end_time
        AND (ps.valid_from IS NULL OR ps.valid_from <= ts.date)
        AND (ps.valid_until IS NULL OR ps.valid_until >= ts.date)
    )
  ORDER BY ts.start_time;
$$;

GRANT EXECUTE ON FUNCTION get_admin_available_slots(DATE, UUID) TO authenticated;

-- =====================================================
-- 2. get_next_admin_slots: nächste N buchbare Slots ab Stichtag/Uhrzeit
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_admin_slots(
  p_practitioner_id UUID,
  p_count INTEGER DEFAULT 4,
  p_after_date DATE DEFAULT CURRENT_DATE,
  p_after_time TIME DEFAULT NULL
)
RETURNS SETOF time_slots
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ts.*
  FROM time_slots ts
  WHERE ts.date >= p_after_date
    AND ts.is_available = true
    -- Wenn am Stichtag: nur spätere Slots
    AND (ts.date > p_after_date OR p_after_time IS NULL OR ts.start_time > p_after_time)
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.time_slot_id = ts.id
        AND a.practitioner_id = p_practitioner_id
        AND a.status <> 'cancelled'
    )
    AND EXISTS (
      SELECT 1 FROM practitioner_schedules ps
      WHERE ps.practitioner_id = p_practitioner_id
        AND ps.is_bookable = true
        AND ps.day_of_week = EXTRACT(ISODOW FROM ts.date)
        AND ts.start_time >= GREATEST(ps.start_time, TIME '09:00')
        AND ts.start_time < ps.end_time
        AND (ps.valid_from IS NULL OR ps.valid_from <= ts.date)
        AND (ps.valid_until IS NULL OR ps.valid_until >= ts.date)
    )
  ORDER BY ts.date, ts.start_time
  LIMIT p_count;
$$;

GRANT EXECUTE ON FUNCTION get_next_admin_slots(UUID, INTEGER, DATE, TIME) TO authenticated;
