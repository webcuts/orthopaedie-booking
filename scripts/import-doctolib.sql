-- =====================================================
-- Doctolib-Import: Bestehende Termine blockieren
-- =====================================================

BEGIN;

-- 1. Staging-Tabelle
CREATE TEMP TABLE staging_csv (
  datum TEXT,
  wochentag TEXT,
  uhrzeit TEXT,
  terminkalender TEXT,
  ressource TEXT,
  status TEXT,
  ankunft_um TEXT,
  patient TEXT,
  terminart TEXT,
  versicherung TEXT,
  externe_nummer TEXT,
  notiz TEXT,
  quelldatei TEXT
);

\COPY staging_csv FROM 'scripts/termine.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';', ENCODING 'UTF8');

-- 2. Staging mit Parsing und Practitioner-Matching
CREATE TEMP TABLE staging_parsed AS
SELECT
  -- Datum DD.MM.YY oder DD.MM.YYYY -> YYYY-MM-DD
  (
    CASE
      WHEN LENGTH(SPLIT_PART(datum, '.', 3)) = 4
        THEN SPLIT_PART(datum, '.', 3)
      ELSE '20' || SPLIT_PART(datum, '.', 3)
    END || '-' ||
    LPAD(SPLIT_PART(datum, '.', 2), 2, '0') || '-' ||
    LPAD(SPLIT_PART(datum, '.', 1), 2, '0')
  )::DATE AS termin_date,
  -- Uhrzeit HH:MM -> HH:MM:00
  (uhrzeit || ':00')::TIME AS termin_time,
  patient,
  terminart,
  versicherung,
  externe_nummer,
  terminkalender,
  -- Practitioner-ID anhand Nachname matchen
  CASE
    WHEN terminkalender ILIKE '%Ercan%' THEN (SELECT id FROM practitioners WHERE last_name = 'Ercan' LIMIT 1)
    WHEN terminkalender ILIKE '%Jonda%' THEN (SELECT id FROM practitioners WHERE last_name = 'Jonda' LIMIT 1)
    WHEN terminkalender ILIKE '%Flores%' THEN (SELECT id FROM practitioners WHERE last_name = 'Flores' LIMIT 1)
    WHEN terminkalender ILIKE '%Namakonova%' THEN (SELECT id FROM practitioners WHERE last_name = 'Namakonova' LIMIT 1)
    ELSE NULL
  END AS practitioner_id
FROM staging_csv
WHERE datum IS NOT NULL AND datum != ''
  AND uhrzeit IS NOT NULL AND uhrzeit != ''
  AND patient IS NOT NULL AND patient != ''
  AND patient != 'Abwesenheit'
  AND patient NOT ILIKE 'Feiertag%';

-- Nur Termine mit erkanntem Practitioner + in der Zukunft behalten
DELETE FROM staging_parsed WHERE practitioner_id IS NULL;
DELETE FROM staging_parsed WHERE termin_date < CURRENT_DATE;

\echo 'Anzahl zu importierender Termine:'
SELECT COUNT(*) FROM staging_parsed;

-- 3. Insurance-Type IDs holen
CREATE TEMP TABLE insurance_map AS
SELECT id AS gkv_id FROM insurance_types WHERE name ILIKE '%Gesetzlich%' LIMIT 1;
CREATE TEMP TABLE insurance_pkv AS
SELECT id AS pkv_id FROM insurance_types WHERE name ILIKE '%Privat%' LIMIT 1;

-- 4. Treatment Type ID (wir nutzen "Sprechstunde" als Default für alle Doctolib-Termine)
CREATE TEMP TABLE treatment_map AS
SELECT id AS tt_id FROM treatment_types WHERE name = 'Sprechstunde' AND is_active = true LIMIT 1;

-- 5. Patienten anlegen (deduplizieren via Name+externe_nummer)
-- Für Doctolib-Import verwenden wir Platzhalter-Telefon falls fehlt (DSGVO-konform)
CREATE TEMP TABLE new_patients AS
SELECT DISTINCT ON (patient, COALESCE(externe_nummer, ''))
  patient AS name,
  externe_nummer,
  CASE WHEN versicherung ILIKE '%Privat%'
    THEN (SELECT pkv_id FROM insurance_pkv)
    ELSE (SELECT gkv_id FROM insurance_map)
  END AS insurance_type_id
FROM staging_parsed;

-- Phone-Platzhalter bauen (Constraint: 6-20 Zeichen, nur [0-9 +()-/])
-- externe_nummer wird auf 6 Stellen gepolstert mit "999" Präfix als Doctolib-Marker
CREATE TEMP TABLE new_patients_with_phone AS
SELECT
  name,
  externe_nummer,
  insurance_type_id,
  CASE
    WHEN NULLIF(externe_nummer, '') IS NOT NULL
      THEN '999' || LPAD(externe_nummer, 6, '0')
    ELSE '999000000'
  END AS phone_placeholder
FROM new_patients;

-- Insert neue Patienten (nur wenn nicht vorhanden)
INSERT INTO patients (name, phone, email, insurance_type_id)
SELECT
  np.name,
  np.phone_placeholder,
  NULL,
  np.insurance_type_id
FROM new_patients_with_phone np
WHERE NOT EXISTS (
  SELECT 1 FROM patients p
  WHERE p.name = np.name
    AND p.phone = np.phone_placeholder
);

\echo 'Patienten-Status (Total / bereits vorhanden):'
SELECT
  COUNT(*) FILTER (WHERE TRUE) AS total,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM patients p
    WHERE p.name = npp.name AND p.phone = npp.phone_placeholder
  )) AS existierend
FROM new_patients_with_phone npp;

-- 6. Time-Slots anlegen oder als blockiert markieren
-- Für jeden Termin: Existiert bereits ein Slot → blockieren; sonst anlegen (blockiert)
CREATE TEMP TABLE slot_mappings AS
SELECT DISTINCT
  sp.termin_date,
  sp.termin_time,
  sp.practitioner_id
FROM staging_parsed sp;

-- UPSERT: Slots anlegen wenn nicht vorhanden, sonst auf is_available=false setzen
INSERT INTO time_slots (date, start_time, end_time, is_available)
SELECT DISTINCT
  sm.termin_date,
  sm.termin_time,
  sm.termin_time + INTERVAL '10 minutes',
  false
FROM slot_mappings sm
ON CONFLICT (date, start_time) DO UPDATE
  SET is_available = false;

\echo 'Time-Slots betroffen:'
SELECT COUNT(*) FROM slot_mappings;

-- 7. Appointments erstellen
INSERT INTO appointments (
  patient_id,
  treatment_type_id,
  time_slot_id,
  practitioner_id,
  status,
  notes,
  language
)
SELECT
  p.id AS patient_id,
  (SELECT tt_id FROM treatment_map) AS treatment_type_id,
  ts.id AS time_slot_id,
  sp.practitioner_id,
  'confirmed' AS status,
  'Doctolib-Import ' || CURRENT_DATE AS notes,
  'de' AS language
FROM staging_parsed sp
JOIN patients p ON p.name = sp.patient
  AND p.phone = CASE
    WHEN NULLIF(sp.externe_nummer, '') IS NOT NULL
      THEN '999' || LPAD(sp.externe_nummer, 6, '0')
    ELSE '999000000'
  END
JOIN time_slots ts ON ts.date = sp.termin_date
  AND ts.start_time = sp.termin_time
-- Bei Doctolib-Duplikaten im selben Slot (2 Patienten gleichzeitig): Slot bleibt geblockt,
-- nur ein Termineintrag wird angelegt, weitere per ON CONFLICT ignoriert
ON CONFLICT (time_slot_id, practitioner_id) WHERE (status <> 'cancelled') DO NOTHING;

\echo 'Appointments angelegt:'
SELECT
  pr.last_name,
  COUNT(*) AS anzahl
FROM appointments a
JOIN practitioners pr ON pr.id = a.practitioner_id
WHERE a.notes = 'Doctolib-Import ' || CURRENT_DATE::TEXT
GROUP BY pr.last_name
ORDER BY pr.last_name;

COMMIT;

\echo 'Import abgeschlossen.'
