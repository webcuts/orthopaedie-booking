-- =====================================================
-- Migration: Praxis-Schließungen mit Zeit-Range (Halbtage etc.)
-- =====================================================
-- Use-Case: vormittags blocken für interne Veranstaltung, Patienten können
-- erst ab z.B. 12:00 buchen. Bisher gab's nur:
--   - holidays: ganztägig zu (Feiertage)
--   - short_practice_days: NACH cutoff_time gesperrt (kurze Mittwoche)
-- Diese Tabelle ist generisch und deckt jeden Zeitraum innerhalb eines Tages.

CREATE TABLE IF NOT EXISTS practice_blocked_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  start_time  TIME NOT NULL DEFAULT '00:00',
  end_time    TIME NOT NULL DEFAULT '23:59',
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_pbp_date ON practice_blocked_periods(date);

ALTER TABLE practice_blocked_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pbp_anon_select" ON practice_blocked_periods;
CREATE POLICY "pbp_anon_select" ON practice_blocked_periods FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "pbp_authenticated_all" ON practice_blocked_periods;
CREATE POLICY "pbp_authenticated_all" ON practice_blocked_periods FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- RPC 1: get_available_dates (Patient-Widget: welche Tage haben freie Slots?)
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
          AND pa.end_date >= ts.date
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

-- =====================================================
-- RPC 2: get_available_slots (Patient-Widget: Slots am Tag)
-- =====================================================
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

-- =====================================================
-- RPC 3: get_admin_available_slots (MFA-Modal Datums-Auswahl)
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
    AND NOT EXISTS (
      SELECT 1 FROM practitioner_absences pa
      WHERE pa.practitioner_id = p_practitioner_id
        AND pa.start_date <= ts.date
        AND pa.end_date >= ts.date
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

-- =====================================================
-- RPC 4: get_next_admin_slots (Admin Schnellauswahl)
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

-- =====================================================
-- RPC 5: get_next_admin_mfa_slots (Admin MFA Schnellauswahl)
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_admin_mfa_slots(
  p_count INTEGER DEFAULT 4,
  p_after_date DATE DEFAULT CURRENT_DATE,
  p_after_time TIME DEFAULT NULL
)
RETURNS TABLE(id UUID, date DATE, start_time TIME, end_time TIME)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT p_after_date AS d,
           COALESCE(p_after_time, (NOW() AT TIME ZONE 'Europe/Berlin')::time) AS t
  ),
  bookings AS (
    SELECT mfa_time_slot_id, COUNT(*) AS booked
    FROM mfa_appointments WHERE status <> 'cancelled'
    GROUP BY mfa_time_slot_id
  )
  SELECT ts.id, ts.date, ts.start_time, ts.end_time
  FROM mfa_time_slots ts
  CROSS JOIN params
  LEFT JOIN bookings b ON b.mfa_time_slot_id = ts.id
  WHERE ts.date >= params.d
    AND (ts.date > params.d OR ts.start_time > params.t)
    AND COALESCE(b.booked, 0) < ts.max_parallel
    AND NOT EXISTS (
      SELECT 1 FROM practice_blocked_periods bp
      WHERE bp.date = ts.date
        AND ts.start_time >= bp.start_time
        AND ts.start_time <  bp.end_time
    )
  ORDER BY ts.date, ts.start_time
  LIMIT p_count;
$$;

-- =====================================================
-- Initial-Eintrag: 02.07.2026 vormittags geblockt (User-Wunsch)
-- =====================================================
INSERT INTO practice_blocked_periods (date, start_time, end_time, reason)
SELECT '2026-07-02'::date, '00:00'::time, '12:00'::time, 'Praxisinterne Veranstaltung'
WHERE NOT EXISTS (
  SELECT 1 FROM practice_blocked_periods
  WHERE date='2026-07-02' AND start_time='00:00'::time AND end_time='12:00'::time
);

DO $$
DECLARE v INT;
BEGIN
  SELECT COUNT(*) INTO v FROM practice_blocked_periods;
  RAISE NOTICE 'practice_blocked_periods Einträge total: %', v;
END $$;
