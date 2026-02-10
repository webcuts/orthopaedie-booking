-- =====================================================
-- Migration 013: RLS Policy Hardening
-- Entfernt zu offene Legacy-Policies aus Migration 001
-- Die korrekten restriktiven Policies aus Migration 004 bleiben bestehen
-- =====================================================

-- time_slots_public_read: USING (true) zeigte ALLE Slots (auch vergangene/belegte)
-- Ersetzt durch "Anon can view available future slots" (Migration 004)
DROP POLICY IF EXISTS "time_slots_public_read" ON time_slots;

-- appointments_anon_insert: WITH CHECK (true) erlaubte jeden Status
-- Ersetzt durch "Anon can create appointments" mit status='confirmed' Check (Migration 004)
DROP POLICY IF EXISTS "appointments_anon_insert" ON appointments;

-- patients_anon_insert: Redundant, Migration 004 hat "Anon can create patients"
DROP POLICY IF EXISTS "patients_anon_insert" ON patients;

-- insurance_types_public_read: Ohne Rolleneinschränkung (gilt für alle Rollen)
-- Ersetzt durch "Anon can view active insurance types" (Migration 004)
DROP POLICY IF EXISTS "insurance_types_public_read" ON insurance_types;

-- treatment_types_public_read: Ohne Rolleneinschränkung
-- Ersetzt durch "Anon can view active treatment types" (Migration 004)
DROP POLICY IF EXISTS "treatment_types_public_read" ON treatment_types;
