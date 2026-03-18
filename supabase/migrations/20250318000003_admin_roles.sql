-- =====================================================
-- ORTHO-050: Admin-Rollenverwaltung
-- =====================================================

-- 1. Admin-Profile Tabelle
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mfa' CHECK (role IN ('admin', 'mfa')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users können ihr eigenes Profil lesen
CREATE POLICY "admin_profiles_self_read"
  ON admin_profiles FOR SELECT TO authenticated
  USING (true);

-- Nur Admins können Profile verwalten
CREATE POLICY "admin_profiles_admin_write"
  ON admin_profiles FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- 2. Bestehende Benutzer als Admins eintragen
INSERT INTO admin_profiles (id, display_name, role, is_active)
SELECT id, COALESCE(raw_user_meta_data->>'display_name', email), 'admin', true
FROM auth.users
WHERE id NOT IN (SELECT id FROM admin_profiles)
ON CONFLICT (id) DO NOTHING;

-- 3. Hilfsfunktion: Rolle des aktuellen Users abfragen
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM admin_profiles WHERE id = auth.uid() AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;
