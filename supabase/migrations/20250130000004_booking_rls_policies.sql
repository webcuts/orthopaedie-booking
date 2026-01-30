-- =====================================================
-- ORTHO: RLS Policies für anonymen Buchungsflow
-- =====================================================

-- =====================================================
-- 1. Lookup-Tabellen (nur SELECT für anon)
-- =====================================================

-- Specialties: Alle können aktive Fachgebiete sehen
DROP POLICY IF EXISTS "Anon can view active specialties" ON specialties;
CREATE POLICY "Anon can view active specialties"
  ON specialties FOR SELECT
  TO anon
  USING (is_active = true);

-- Insurance Types: Alle können aktive Versicherungsarten sehen
DROP POLICY IF EXISTS "Anon can view active insurance types" ON insurance_types;
CREATE POLICY "Anon can view active insurance types"
  ON insurance_types FOR SELECT
  TO anon
  USING (is_active = true);

-- Treatment Types: Alle können aktive Behandlungsarten sehen
DROP POLICY IF EXISTS "Anon can view active treatment types" ON treatment_types;
CREATE POLICY "Anon can view active treatment types"
  ON treatment_types FOR SELECT
  TO anon
  USING (is_active = true);

-- Practitioners: Alle können aktive Behandler sehen
DROP POLICY IF EXISTS "Anon can view active practitioners" ON practitioners;
CREATE POLICY "Anon can view active practitioners"
  ON practitioners FOR SELECT
  TO anon
  USING (is_active = true);

-- Practice Hours: Alle können Öffnungszeiten sehen
DROP POLICY IF EXISTS "Anon can view practice hours" ON practice_hours;
CREATE POLICY "Anon can view practice hours"
  ON practice_hours FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- 2. Time Slots (SELECT + UPDATE für anon)
-- =====================================================

-- SELECT: Nur verfügbare Slots in der Zukunft
DROP POLICY IF EXISTS "Anon can view available future slots" ON time_slots;
CREATE POLICY "Anon can view available future slots"
  ON time_slots FOR SELECT
  TO anon
  USING (
    is_available = true
    AND date >= CURRENT_DATE
  );

-- UPDATE: Nur is_available von true auf false setzen (Buchung)
DROP POLICY IF EXISTS "Anon can book available slots" ON time_slots;
CREATE POLICY "Anon can book available slots"
  ON time_slots FOR UPDATE
  TO anon
  USING (is_available = true)
  WITH CHECK (is_available = false);

-- =====================================================
-- 3. Patients (INSERT + eingeschränkter SELECT für anon)
-- =====================================================

-- INSERT: Anonyme können Patienten erstellen
DROP POLICY IF EXISTS "Anon can create patients" ON patients;
CREATE POLICY "Anon can create patients"
  ON patients FOR INSERT
  TO anon
  WITH CHECK (true);

-- SELECT: Nur den gerade erstellten Patienten (für Rückgabe nach INSERT)
-- Einschränkung: Nur innerhalb von 5 Minuten nach Erstellung
DROP POLICY IF EXISTS "Anon can view recently created patients" ON patients;
CREATE POLICY "Anon can view recently created patients"
  ON patients FOR SELECT
  TO anon
  USING (
    created_at >= NOW() - INTERVAL '5 minutes'
  );

-- =====================================================
-- 4. Appointments (INSERT + eingeschränkter SELECT für anon)
-- =====================================================

-- INSERT: Anonyme können Termine erstellen (nur pending Status)
DROP POLICY IF EXISTS "Anon can create appointments" ON appointments;
CREATE POLICY "Anon can create appointments"
  ON appointments FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');

-- SELECT: Nur den gerade erstellten Termin (für Bestätigungsseite)
DROP POLICY IF EXISTS "Anon can view recently created appointments" ON appointments;
CREATE POLICY "Anon can view recently created appointments"
  ON appointments FOR SELECT
  TO anon
  USING (
    created_at >= NOW() - INTERVAL '5 minutes'
    AND status = 'pending'
  );

-- =====================================================
-- 5. Admin-Zugriff (authenticated users haben vollen Zugriff)
-- =====================================================

-- Specialties
DROP POLICY IF EXISTS "Authenticated users have full access to specialties" ON specialties;
CREATE POLICY "Authenticated users have full access to specialties"
  ON specialties FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insurance Types
DROP POLICY IF EXISTS "Authenticated users have full access to insurance_types" ON insurance_types;
CREATE POLICY "Authenticated users have full access to insurance_types"
  ON insurance_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Treatment Types
DROP POLICY IF EXISTS "Authenticated users have full access to treatment_types" ON treatment_types;
CREATE POLICY "Authenticated users have full access to treatment_types"
  ON treatment_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Practitioners
DROP POLICY IF EXISTS "Authenticated users have full access to practitioners" ON practitioners;
CREATE POLICY "Authenticated users have full access to practitioners"
  ON practitioners FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Practice Hours
DROP POLICY IF EXISTS "Authenticated users have full access to practice_hours" ON practice_hours;
CREATE POLICY "Authenticated users have full access to practice_hours"
  ON practice_hours FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Time Slots
DROP POLICY IF EXISTS "Authenticated users have full access to time_slots" ON time_slots;
CREATE POLICY "Authenticated users have full access to time_slots"
  ON time_slots FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Patients
DROP POLICY IF EXISTS "Authenticated users have full access to patients" ON patients;
CREATE POLICY "Authenticated users have full access to patients"
  ON patients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Appointments
DROP POLICY IF EXISTS "Authenticated users have full access to appointments" ON appointments;
CREATE POLICY "Authenticated users have full access to appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 6. RLS aktivieren (falls noch nicht aktiv)
-- =====================================================

ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
