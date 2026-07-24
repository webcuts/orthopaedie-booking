-- =====================================================
-- Migration: Verkürzte Mittwoche bis 12:30 buchbar (statt 11:00)
-- =====================================================
-- Bisher (Mig 14): Cutoff 11:00 → letzter Slot 10:50.
-- Neu:             Cutoff 12:30 → letzter Slot 12:20.
--
-- Betrifft ALLE Einträge in short_practice_days (zweiwöchentliche kurze Mi
-- ab 20.05.2026). Das 10-Min-Raster (Mig 03) macht 12:20 zum letzten
-- buchbaren Slot vor dem 12:30-Cutoff.
--
-- Cron-Job (Mig 14) und Slot-Reset (Mig 18) lesen spd.cutoff_time dynamisch
-- → keine Anpassung nötig, sie verwenden den neuen Wert automatisch.

-- 1. Cutoff für bestehende kurze Mittwoche auf 12:30 anheben
UPDATE short_practice_days
SET cutoff_time = '12:30:00'
WHERE cutoff_time = '11:00:00';

-- 2. Spalten-Default anheben (falls künftig Zeilen ohne expliziten Cutoff angelegt werden)
ALTER TABLE short_practice_days ALTER COLUMN cutoff_time SET DEFAULT '12:30:00';

-- 3. Fälschlich (durch alten 11:00-Cutoff) blockierte Slots wieder freigeben.
--    Nur das exakte Fenster 11:00–12:20 an kurzen Mi in der Zukunft.
--    Bewusst NICHT angefasst:
--      - gebuchte Slots (aktives Appointment) → Trigger-Invariante Mig 09 wahren
--      - Feiertage → bleiben hart geblockt (Mig 03)
--    Abwesenheiten / Sprechzeiten / Blocked-Periods müssen hier nicht geprüft
--    werden: die Patienten-RPCs (Mig 32) re-validieren diese live zusätzlich
--    zu is_available.
UPDATE time_slots ts
SET is_available = true
FROM short_practice_days spd
WHERE ts.date = spd.date
  AND ts.date >= CURRENT_DATE
  AND ts.start_time >= '11:00:00'
  AND ts.start_time <  spd.cutoff_time      -- < 12:30
  AND ts.is_available = false
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.time_slot_id = ts.id
      AND a.status <> 'cancelled'
  )
  AND NOT EXISTS (
    SELECT 1 FROM holidays h WHERE h.date = ts.date
  );

-- 4. Verifikation
DO $$
DECLARE
  v_offen  INTEGER;
  v_11uhr  INTEGER;
BEGIN
  -- kurze Mi in Zukunft, deren Cutoff jetzt korrekt 12:30 ist
  SELECT COUNT(*) INTO v_offen
  FROM short_practice_days
  WHERE date >= CURRENT_DATE AND cutoff_time = '12:30:00';

  -- Dürfte 0 sein: kein zukünftiger kurzer Mi mehr mit altem 11:00-Cutoff
  SELECT COUNT(*) INTO v_11uhr
  FROM short_practice_days
  WHERE date >= CURRENT_DATE AND cutoff_time = '11:00:00';

  RAISE NOTICE 'Kurze Mi (Zukunft) mit 12:30-Cutoff: %, mit altem 11:00-Cutoff: %', v_offen, v_11uhr;

  IF v_11uhr > 0 THEN
    RAISE EXCEPTION 'Migration fehlgeschlagen: % kurze Mi haben noch 11:00-Cutoff', v_11uhr;
  END IF;
END $$;
