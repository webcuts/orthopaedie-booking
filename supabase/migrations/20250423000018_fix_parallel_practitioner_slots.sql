-- =====================================================
-- Migration: Slots erlauben parallele Behandler (Bug-Fix)
-- =====================================================
-- Problem: trg_block_slot_on_appointment hat is_available=false global gesetzt
-- sobald EIN Behandler einen Termin im Slot hatte. Damit wurde Jwan blockiert,
-- obwohl er parallel zu Jondas Doctolib-Termin frei wäre.
--
-- Praxis-Realität: mehrere Behandler arbeiten parallel in eigenen Räumen.
-- Doppelbuchung beim gleichen Behandler wird durch UNIQUE-Constraint
-- (idx_unique_active_booking) verhindert — das reicht aus.
--
-- Lösung:
--   1. Trigger entfernen (er blockiert zu aggressiv)
--   2. is_available zurücksetzen für Slots die fälschlich global blockiert wurden
--      — außer wo es legitime Gründe gibt: pre-09:00, kurze Mi, Feiertage

-- 1. Trigger entfernen
DROP TRIGGER IF EXISTS trg_block_slot_on_appointment ON appointments;
DROP FUNCTION IF EXISTS block_slot_on_active_appointment();

-- 2. Slots zurücksetzen: alle die JETZT is_available=false sind, aber nicht
-- aus legitimen Gründen blockiert wurden (pre-09:00, kurze Mi, Feiertage)
UPDATE time_slots ts
SET is_available = true
WHERE ts.is_available = false
  AND ts.date >= CURRENT_DATE
  AND ts.start_time >= '09:00:00'
  -- Nicht in kurzem Mittwoch nach Cutoff
  AND NOT EXISTS (
    SELECT 1 FROM short_practice_days spd
    WHERE spd.date = ts.date AND ts.start_time >= spd.cutoff_time
  )
  -- Nicht an Feiertag
  AND NOT EXISTS (
    SELECT 1 FROM holidays h WHERE h.date = ts.date
  );

-- 3. get_next_admin_slots-RPC anpassen: standardmäßig ab JETZT (Berliner Zeit),
-- nicht ab Tagesbeginn — sonst zeigt sie heute vormittag Slots an, die schon vorbei sind.
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

-- 4. Verifikation
DO $$
DECLARE
  v_reopened INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_reopened
  FROM time_slots ts
  WHERE ts.date >= CURRENT_DATE AND ts.start_time >= '09:00:00'
    AND ts.is_available = true;
  RAISE NOTICE 'Slots ab heute mit is_available=true: %', v_reopened;
END $$;
