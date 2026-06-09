-- =====================================================
-- Migration: Behandler-Abwesenheiten mit Zeit-Range (halbe Tage)
-- =====================================================
-- Erweitert practitioner_absences um optionale start_time/end_time.
-- NULL bei beiden = ganztägig (Backward-Compat zur bisherigen Logik).
-- Gesetzt = nur dieser Zeitraum innerhalb jedes Tages im Datumsbereich.

ALTER TABLE practitioner_absences
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;

-- Constraint: entweder beide NULL oder beide gesetzt mit start < end
ALTER TABLE practitioner_absences
  DROP CONSTRAINT IF EXISTS absence_time_range_valid;
ALTER TABLE practitioner_absences
  ADD CONSTRAINT absence_time_range_valid CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  );

-- =====================================================
-- RPCs neu definieren: Absence-Check beachtet jetzt Zeit-Range
-- Pattern: Slot ausschließen wenn Absence-Range matched UND
--          entweder ganztägig (beide NULL) ODER Slot.start innerhalb
--          [Absence.start_time, Absence.end_time)
-- =====================================================

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
        AND ps.day_of_week = EXTRACT(ISODOW FROM ts.date)
        AND ts.start_time >= GREATEST(ps.start_time, TIME '09:00')
        AND ts.start_time < ps.end_time
        AND (ps.valid_from  IS NULL OR ps.valid_from  <= ts.date)
        AND (ps.valid_until IS NULL OR ps.valid_until >= ts.date)
    )
  ORDER BY ts.start_time;
$$;

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
  WITH params AS (
    SELECT p_after_date AS d,
           COALESCE(p_after_time, (NOW() AT TIME ZONE 'Europe/Berlin')::time) AS t
  )
  SELECT ts.*
  FROM time_slots ts, params
  WHERE ts.date >= params.d
    AND ts.is_available = true
    AND (ts.date > params.d OR ts.start_time > params.t)
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.time_slot_id = ts.id
        AND a.practitioner_id = p_practitioner_id
        AND a.status <> 'cancelled'
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
        AND ps.day_of_week = EXTRACT(ISODOW FROM ts.date)
        AND ts.start_time >= GREATEST(ps.start_time, TIME '09:00')
        AND ts.start_time < ps.end_time
        AND (ps.valid_from  IS NULL OR ps.valid_from  <= ts.date)
        AND (ps.valid_until IS NULL OR ps.valid_until >= ts.date)
    )
  ORDER BY ts.date, ts.start_time
  LIMIT p_count;
$$;

DO $$
DECLARE v INT;
BEGIN
  SELECT COUNT(*) INTO v FROM practitioner_absences WHERE start_time IS NOT NULL;
  RAISE NOTICE 'Zeit-Range Abwesenheiten (Migration noop): %', v;
END $$;
