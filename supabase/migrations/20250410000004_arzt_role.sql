-- =====================================================
-- ORTHO-059: Dritte Rolle 'Arzt' im Admin-Dashboard
-- Ärzte können ihren eigenen Kalender und Abwesenheiten sehen
-- =====================================================

-- 1. Role-Constraint erweitern: 'arzt' hinzufügen
ALTER TABLE admin_profiles
DROP CONSTRAINT IF EXISTS admin_profiles_role_check;

ALTER TABLE admin_profiles
ADD CONSTRAINT admin_profiles_role_check
CHECK (role IN ('admin', 'mfa', 'arzt'));

-- 2. practitioner_id Spalte für Arzt-Profile (Verknüpfung zum Behandler)
ALTER TABLE admin_profiles
ADD COLUMN practitioner_id UUID REFERENCES practitioners(id) ON DELETE SET NULL;

COMMENT ON COLUMN admin_profiles.practitioner_id IS 'Verknüpfung zum Behandler-Profil (nur für Rolle arzt)';

-- 3. RLS: Ärzte sehen nur eigene Termine und Abwesenheiten
-- Bestehende Policies bleiben (anon read, authenticated full access)
-- Für Termine: Arzt sieht nur seine eigenen via practitioner_id
-- Die Filterung erfolgt hauptsächlich im Frontend (DashboardPage)

-- 4. Absences: Ärzte können nur eigene Abwesenheiten erstellen/bearbeiten
-- Bestehende Policies erlauben bereits authenticated full access
-- Wir ergänzen eine restriktivere Policy für Insert/Update
CREATE POLICY "absences_arzt_own_only_insert"
  ON practitioner_absences FOR INSERT TO authenticated
  WITH CHECK (
    -- Admins und MFAs können alle Abwesenheiten verwalten
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'mfa') AND is_active = true
    )
    OR
    -- Ärzte nur eigene Abwesenheiten
    (
      practitioner_id = (
        SELECT practitioner_id FROM admin_profiles
        WHERE id = auth.uid() AND role = 'arzt' AND is_active = true
      )
    )
  );

CREATE POLICY "absences_arzt_own_only_update"
  ON practitioner_absences FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'mfa') AND is_active = true
    )
    OR
    (
      practitioner_id = (
        SELECT practitioner_id FROM admin_profiles
        WHERE id = auth.uid() AND role = 'arzt' AND is_active = true
      )
    )
  );
