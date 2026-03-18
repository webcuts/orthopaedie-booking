-- =====================================================
-- Fix: Zirkuläre RLS-Policy auf admin_profiles entfernen
-- FOR ALL inkl. SELECT verursacht Endlosschleife
-- =====================================================

-- Problematische Policy entfernen
DROP POLICY IF EXISTS "admin_profiles_admin_write" ON admin_profiles;

-- Neue Policies: Nur für Schreiboperationen (nicht SELECT)
CREATE POLICY "admin_profiles_admin_insert"
  ON admin_profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

CREATE POLICY "admin_profiles_admin_update"
  ON admin_profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

CREATE POLICY "admin_profiles_admin_delete"
  ON admin_profiles FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );
