-- =====================================================
-- Anpassungen April 2026:
-- 1. Feiertage-Tabelle + Blockierung aller Slots an Feiertagen
-- 2. Dr. Ercan Freitag: nur noch 13:30-16:00 buchbar
-- 3. Dr. Namakonova: erstmal nicht buchbar (available_from in die Zukunft)
-- 4. Jwan Mohammed: ab 01.05.2026 buchbar (aktivieren + available_from)
-- =====================================================

-- 1a) Feiertags-Tabelle
CREATE TABLE IF NOT EXISTS holidays (
  date DATE PRIMARY KEY,
  name TEXT NOT NULL
);

-- Öffentlicher Lesezugriff (damit der Widget-Client das weiß, falls nötig)
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays_public_read" ON holidays FOR SELECT TO anon, authenticated USING (true);

-- 1b) Feiertage Niedersachsen 2026 + 2027 seeden
INSERT INTO holidays (date, name) VALUES
  ('2026-01-01', 'Neujahr'),
  ('2026-04-03', 'Karfreitag'),
  ('2026-04-05', 'Ostersonntag'),
  ('2026-04-06', 'Ostermontag'),
  ('2026-05-01', 'Tag der Arbeit'),
  ('2026-05-14', 'Christi Himmelfahrt'),
  ('2026-05-24', 'Pfingstsonntag'),
  ('2026-05-25', 'Pfingstmontag'),
  ('2026-10-03', 'Tag der Deutschen Einheit'),
  ('2026-10-31', 'Reformationstag'),
  ('2026-12-25', '1. Weihnachtstag'),
  ('2026-12-26', '2. Weihnachtstag'),
  ('2027-01-01', 'Neujahr'),
  ('2027-03-26', 'Karfreitag'),
  ('2027-03-28', 'Ostersonntag'),
  ('2027-03-29', 'Ostermontag'),
  ('2027-05-01', 'Tag der Arbeit'),
  ('2027-05-06', 'Christi Himmelfahrt'),
  ('2027-05-16', 'Pfingstsonntag'),
  ('2027-05-17', 'Pfingstmontag'),
  ('2027-10-03', 'Tag der Deutschen Einheit'),
  ('2027-10-31', 'Reformationstag'),
  ('2027-12-25', '1. Weihnachtstag'),
  ('2027-12-26', '2. Weihnachtstag')
ON CONFLICT (date) DO NOTHING;

-- 1c) Alle bestehenden Slots an Feiertagen blockieren
UPDATE time_slots
SET is_available = false
WHERE date IN (SELECT date FROM holidays);

UPDATE mfa_time_slots
SET max_parallel = 0
WHERE date IN (SELECT date FROM holidays);

-- 1d) Trigger, die automatisch alle zukünftig erzeugten Slots an Feiertagen blockieren
CREATE OR REPLACE FUNCTION block_slot_if_holiday()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM holidays WHERE date = NEW.date) THEN
    NEW.is_available = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION block_mfa_slot_if_holiday()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM holidays WHERE date = NEW.date) THEN
    NEW.max_parallel = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_time_slot_on_holiday ON time_slots;
CREATE TRIGGER trg_block_time_slot_on_holiday
  BEFORE INSERT OR UPDATE OF date ON time_slots
  FOR EACH ROW EXECUTE FUNCTION block_slot_if_holiday();

DROP TRIGGER IF EXISTS trg_block_mfa_slot_on_holiday ON mfa_time_slots;
CREATE TRIGGER trg_block_mfa_slot_on_holiday
  BEFORE INSERT OR UPDATE OF date ON mfa_time_slots
  FOR EACH ROW EXECUTE FUNCTION block_mfa_slot_if_holiday();

-- 2) Dr. Ercan Freitag: von 07:45-16:00 auf 13:30-16:00 ändern
DO $$
DECLARE v_ercan UUID;
BEGIN
  SELECT id INTO v_ercan FROM practitioners WHERE last_name = 'Ercan' LIMIT 1;

  -- Alte Freitag-Sprechstunde beenden
  UPDATE practitioner_schedules
  SET valid_until = CURRENT_DATE - INTERVAL '1 day'
  WHERE practitioner_id = v_ercan
    AND day_of_week = 5
    AND is_bookable = true
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

  -- Neue Freitag-Sprechstunde ab heute
  INSERT INTO practitioner_schedules
    (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
  VALUES
    (v_ercan, 5, '13:30', '16:00', true, 'all', 'Sprechstunde', CURRENT_DATE, NULL);
END $$;

-- Alle existierenden buchbaren Freitag-Slots vor 13:30 blockieren (damit Patienten sie nicht mehr sehen)
UPDATE time_slots
SET is_available = false
WHERE is_available = true
  AND start_time < '13:30'
  AND date >= CURRENT_DATE
  AND EXTRACT(DOW FROM date) = 5;  -- Freitag (0=So, 5=Fr)

-- 3) Dr. Namakonova: erstmal nicht buchbar
UPDATE practitioners
SET available_from = '2099-12-31'
WHERE last_name = 'Namakonova';

-- 4) Jwan Mohammed: ab 01.05.2026 buchbar
UPDATE practitioners
SET is_active = true,
    available_from = '2026-05-01'
WHERE last_name = 'Mohammed';

-- Kontroll-Abfragen (werden ausgegeben)
SELECT 'Feiertage eingetragen:' AS info, COUNT(*)::text AS anzahl FROM holidays;
SELECT 'Blockierte Slots an Feiertagen (time_slots):' AS info, COUNT(*)::text FROM time_slots WHERE date IN (SELECT date FROM holidays) AND is_available = false;
SELECT 'Blockierte MFA-Slots an Feiertagen:' AS info, COUNT(*)::text FROM mfa_time_slots WHERE date IN (SELECT date FROM holidays) AND max_parallel = 0;
SELECT 'Blockierte Fr-Morgenslots (< 13:30, zukünftig):' AS info, COUNT(*)::text FROM time_slots WHERE start_time < '13:30' AND date >= CURRENT_DATE AND EXTRACT(DOW FROM date) = 5 AND is_available = false;
