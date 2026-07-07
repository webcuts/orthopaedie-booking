-- =====================================================
-- Migration: Patient-RPCs berücksichtigen Behandler-Schedule
-- =====================================================
-- Bug: get_available_dates / get_available_slots zeigten Tage/Slots als
-- verfügbar, wenn is_available=true + kein Termin + kein Absence, ohne
-- zu prüfen, ob der Slot überhaupt in der Sprechzeit des Behandlers liegt.
-- Folge: Ercan Fr im Juli erscheint als 'buchbar', obwohl seine 9-17 Slots
-- alle voll sind und nur nachmittags außerhalb Sprechzeit noch is_available
-- gemarkte Slots existieren.
--
-- Fix: Zusätzliches EXISTS gegen practitioner_schedules mit
-- Schedule-Fenster-Check (day_of_week + valid_from/until + 09:00-Cap
-- außer Sa) — analog zu get_admin_available_slots.

CREATE OR REPLACE FUNCTION get_available_dates(
  p_start_date DATE,
  p_end_date   DATE,
  p_practitioner_id UUID DEFAULT NULL
)
RETURNS TABLE(date DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_practitioner_id IS NOT NULL THEN
    RETURN QUERY
    SELECT DISTINCT ts.date
    FROM time_slots ts
    WHERE ts.date >= p_start_date AND ts.date <= p_end_date
      AND ts.is_available = true
      AND NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.time_slot_id = ts.id
          AND a.practitioner_id = p_practitioner_id
          AND a.status != 'cancelled'
      )
      AND NOT EXISTS (
        SELECT 1 FROM practitioner_absences pa
        WHERE pa.practitioner_id = p_practitioner_id
          AND pa.start_date <= ts.date
          AND pa.end_date   >= ts.date
          AND (
            pa.start_time IS NULL
            OR (ts.start_time >= pa.start_time AND ts.start_time < pa.end_time)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM practice_blocked_periods bp
        WHERE bp.date = ts.date
          AND ts.start_time >= bp.start_time
          AND ts.start_time <  bp.end_time
      )
      AND EXISTS (
        SELECT 1 FROM practitioner_schedules ps
        WHERE ps.practitioner_id = p_practitioner_id
          AND ps.is_bookable = true
          AND ps.day_of_week = EXTRACT(DOW FROM ts.date)
          AND ts.start_time >= CASE
            WHEN EXTRACT(ISODOW FROM ts.date) BETWEEN 1 AND 5 THEN GREATEST(ps.start_time, TIME '09:00')
            ELSE ps.start_time
          END
          AND ts.start_time < ps.end_time
          AND (ps.valid_from  IS NULL OR ps.valid_from  <= ts.date)
          AND (ps.valid_until IS NULL OR ps.valid_until >= ts.date)
      )
    ORDER BY ts.date;
  ELSE
    RETURN QUERY
    SELECT DISTINCT ts.date
    FROM time_slots ts
    WHERE ts.date >= p_start_date AND ts.date <= p_end_date
      AND ts.is_available = true
      AND NOT EXISTS (
        SELECT 1 FROM practice_blocked_periods bp
        WHERE bp.date = ts.date
          AND ts.start_time >= bp.start_time
          AND ts.start_time <  bp.end_time
      )
    ORDER BY ts.date;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_available_slots(
  p_date DATE,
  p_practitioner_id UUID DEFAULT NULL
)
RETURNS SETOF time_slots
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_practitioner_id IS NOT NULL THEN
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
      AND NOT EXISTS (
        SELECT 1 FROM practitioner_absences pa
        WHERE pa.practitioner_id = p_practitioner_id
          AND pa.start_date <= ts.date
          AND pa.end_date   >= ts.date
          AND (
            pa.start_time IS NULL
            OR (ts.start_time >= pa.start_time AND ts.start_time < pa.end_time)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM practice_blocked_periods bp
        WHERE bp.date = ts.date
          AND ts.start_time >= bp.start_time
          AND ts.start_time <  bp.end_time
      )
      AND EXISTS (
        SELECT 1 FROM practitioner_schedules ps
        WHERE ps.practitioner_id = p_practitioner_id
          AND ps.is_bookable = true
          AND ps.day_of_week = EXTRACT(DOW FROM ts.date)
          AND ts.start_time >= CASE
            WHEN EXTRACT(ISODOW FROM ts.date) BETWEEN 1 AND 5 THEN GREATEST(ps.start_time, TIME '09:00')
            ELSE ps.start_time
          END
          AND ts.start_time < ps.end_time
          AND (ps.valid_from  IS NULL OR ps.valid_from  <= ts.date)
          AND (ps.valid_until IS NULL OR ps.valid_until >= ts.date)
      )
    ORDER BY ts.start_time;
  ELSE
    RETURN QUERY
    SELECT ts.*
    FROM time_slots ts
    WHERE ts.date = p_date AND ts.is_available = true
      AND NOT EXISTS (
        SELECT 1 FROM practice_blocked_periods bp
        WHERE bp.date = ts.date
          AND ts.start_time >= bp.start_time
          AND ts.start_time <  bp.end_time
      )
    ORDER BY ts.start_time;
  END IF;
END $$;
