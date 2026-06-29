-- =====================================================
-- Migration: Samstag-Termine ab 08:00 online buchbar (kein 09:00-Cap am Sa)
-- =====================================================
-- Der 09:00-Cap (Notfallsprechstunden) gilt nur Mo–Fr. Samstags sind
-- Sa-Schedules von Anfang an als 08:00–15:00 angelegt und sollen online
-- buchbar sein.
--
-- Bisher:
-- 1. Migration 15 hatte alle Slots < 09:00 auf is_available=false gesetzt
--    (ohne Wochentag-Unterscheidung) → Sa pre-09 Slots blockiert.
-- 2. Admin-RPCs cappen via GREATEST(ps.start_time, TIME '09:00') → Sa
--    Schedule 08:00–15:00 zeigt für Admin trotzdem erst ab 09:00.
--
-- Fix:
-- 1. Sa-Slots ab heute mit start_time < 09:00 wieder is_available=true setzen.
-- 2. Admin-RPCs neu schreiben mit Bedingung: 09:00-Cap nur Mo–Fr,
--    Sa beginnt um ps.start_time (typisch 08:00).

-- 1. Sa-Slots vor 09:00 freigeben
UPDATE time_slots
SET is_available = true
WHERE EXTRACT(DOW FROM date) = 6
  AND start_time < '09:00'
  AND date >= CURRENT_DATE
  AND is_available = false
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.time_slot_id = time_slots.id AND a.status <> 'cancelled'
  );

-- 2. RPCs neu definieren: 09:00-Cap nur für Mo–Fr (EXTRACT(DOW) IN 1..5)

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
        -- 09:00-Cap nur Mo–Fr; Sa+So nutzen den Schedule-Start direkt
        AND ts.start_time >= CASE
          WHEN EXTRACT(ISODOW FROM ts.date) BETWEEN 1 AND 5 THEN GREATEST(ps.start_time, TIME '09:00')
          ELSE ps.start_time
        END
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
        AND ts.start_time >= CASE
          WHEN EXTRACT(ISODOW FROM ts.date) BETWEEN 1 AND 5 THEN GREATEST(ps.start_time, TIME '09:00')
          ELSE ps.start_time
        END
        AND ts.start_time < ps.end_time
        AND (ps.valid_from  IS NULL OR ps.valid_from  <= ts.date)
        AND (ps.valid_until IS NULL OR ps.valid_until >= ts.date)
    )
  ORDER BY ts.date, ts.start_time
  LIMIT p_count;
$$;

DO $$
DECLARE v_reopened INT;
BEGIN
  SELECT COUNT(*) INTO v_reopened FROM time_slots
   WHERE EXTRACT(DOW FROM date)=6 AND start_time<'09:00'
     AND date>=CURRENT_DATE AND is_available=true;
  RAISE NOTICE 'Sa pre-09 Slots is_available=true ab heute: %', v_reopened;
END $$;
