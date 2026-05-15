-- =====================================================
-- Migration: RPCs respektieren practitioner_absences (Urlaub/Krank)
-- =====================================================
-- Bug: get_available_dates / get_available_slots / get_admin_available_slots /
-- get_next_admin_slots prüften nur is_available + Termin-Existenz, aber NICHT
-- ob der Behandler im Urlaub ist. → Patienten konnten Termine an Urlaubstagen buchen.

-- 1. get_available_dates (Patient-Widget: welche Tage haben freie Slots?)
CREATE OR REPLACE FUNCTION get_available_dates(
  p_start_date DATE,
  p_end_date DATE,
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
          AND pa.end_date >= ts.date
      )
    ORDER BY ts.date;
  ELSE
    RETURN QUERY
    SELECT DISTINCT ts.date
    FROM time_slots ts
    WHERE ts.date >= p_start_date AND ts.date <= p_end_date
      AND ts.is_available = true
    ORDER BY ts.date;
  END IF;
END $$;

-- 2. get_available_slots (Patient-Widget: welche Slots am gewählten Tag?)
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
          AND pa.end_date >= ts.date
      )
    ORDER BY ts.start_time;
  ELSE
    RETURN QUERY
    SELECT ts.*
    FROM time_slots ts
    WHERE ts.date = p_date AND ts.is_available = true
    ORDER BY ts.start_time;
  END IF;
END $$;

-- 3. get_admin_available_slots (MFA-Modal manuelle Datums-Auswahl)
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
        AND pa.end_date >= ts.date
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

-- 4. get_next_admin_slots (Schnellauswahl: nächste N freie Slots)
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
        AND pa.end_date >= ts.date
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
