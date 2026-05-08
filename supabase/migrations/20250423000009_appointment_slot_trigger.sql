-- =====================================================
-- Migration: Auto-Block time_slots wenn Appointment angelegt/aktiv
-- =====================================================
-- Hintergrund:
-- Der Booking-Flow setzte time_slots.is_available=false nicht zuverlässig.
-- Folge: 13 Slots hatten Termine drin, waren aber als "verfügbar" markiert
-- → potenzielle Doppelbuchungen.
--
-- Diese Migration macht is_available zur DB-garantierten Invariante:
-- Sobald ein Appointment mit status != 'cancelled' existiert, ist der Slot blockiert.

-- =====================================================
-- Trigger-Funktion
-- =====================================================
CREATE OR REPLACE FUNCTION block_slot_on_active_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- INSERT oder UPDATE auf neue Zeile mit aktivem Status
  -- → Slot blockieren
  IF NEW.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE time_slots
    SET is_available = false
    WHERE id = NEW.time_slot_id
      AND is_available = true;  -- nur wenn nötig (vermeidet leere Updates)
  END IF;

  -- Hinweis: Cancellation gibt den Slot bewusst NICHT automatisch frei.
  -- Gründe: der Slot könnte aus anderem Grund blockiert sein
  -- (Doctolib-Termin gleichzeitig, Feiertag, Schedule-Sperre, manuell).
  -- Admin gibt Slots manuell frei, wenn nötig.

  RETURN NEW;
END;
$$;

-- =====================================================
-- Trigger anhängen
-- =====================================================
DROP TRIGGER IF EXISTS trg_block_slot_on_appointment ON appointments;

CREATE TRIGGER trg_block_slot_on_appointment
AFTER INSERT OR UPDATE OF status, time_slot_id ON appointments
FOR EACH ROW
EXECUTE FUNCTION block_slot_on_active_appointment();

-- =====================================================
-- Bestand-Reparatur: alle Slots mit aktiven Appointments blocken
-- (sollte nach manueller Reparatur 0 Zeilen treffen, ist aber Belt-and-Suspenders)
-- =====================================================
UPDATE time_slots ts
SET is_available = false
WHERE is_available = true
  AND date >= CURRENT_DATE
  AND EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.time_slot_id = ts.id
      AND a.status <> 'cancelled'
  );

-- =====================================================
-- Verifikation
-- =====================================================
DO $$
DECLARE
  v_inkonsistenzen INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_inkonsistenzen
  FROM time_slots ts
  JOIN appointments a ON a.time_slot_id = ts.id
  WHERE ts.is_available = true
    AND a.status <> 'cancelled'
    AND ts.date >= CURRENT_DATE;

  IF v_inkonsistenzen > 0 THEN
    RAISE EXCEPTION 'Migration fehlgeschlagen: noch % inkonsistente Slots', v_inkonsistenzen;
  END IF;

  RAISE NOTICE 'Migration ok: 0 Inkonsistenzen, Trigger aktiv.';
END $$;
