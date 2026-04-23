-- =====================================================
-- Dienstplan für MFA-Wochenplanung
-- 3 neue Tabellen: shift_templates, weekly_schedules, shifts
-- Nutzt admin_profiles (role='mfa') als Staff-Quelle
-- =====================================================

-- =====================================================
-- 1. Schichtvorlagen (wiederverwendbare Templates)
-- =====================================================
CREATE TABLE shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  ends_with_closing BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#2674BB',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT shift_template_time_valid CHECK (
    ends_with_closing = true OR (end_time IS NOT NULL AND end_time > start_time)
  )
);

COMMENT ON COLUMN shift_templates.ends_with_closing IS 'Wenn true, gilt "bis Praxisende" statt einer festen end_time';

-- =====================================================
-- 2. Wochenplan-Metadaten
-- =====================================================
CREATE TYPE schedule_status AS ENUM ('draft', 'published');

CREATE TABLE weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL UNIQUE,  -- Montag der Woche
  status schedule_status NOT NULL DEFAULT 'draft',
  team_note TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT week_starts_on_monday CHECK (EXTRACT(DOW FROM week_start_date) = 1)
);

CREATE INDEX idx_weekly_schedules_week ON weekly_schedules(week_start_date);
CREATE INDEX idx_weekly_schedules_status ON weekly_schedules(status);

-- =====================================================
-- 3. Einzelne Schichten
-- =====================================================
CREATE TYPE shift_type AS ENUM ('work', 'vacation', 'sick', 'off');

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_schedule_id UUID NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  staff_member_id UUID NOT NULL REFERENCES admin_profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  ends_with_closing BOOLEAN NOT NULL DEFAULT false,
  shift_type shift_type NOT NULL DEFAULT 'work',
  note TEXT,
  template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT shift_work_has_times CHECK (
    shift_type != 'work' OR
    (start_time IS NOT NULL AND (ends_with_closing = true OR end_time IS NOT NULL))
  ),
  CONSTRAINT shift_time_order CHECK (
    end_time IS NULL OR start_time IS NULL OR end_time > start_time
  )
);

CREATE INDEX idx_shifts_schedule ON shifts(weekly_schedule_id);
CREATE INDEX idx_shifts_staff_date ON shifts(staff_member_id, shift_date);
CREATE INDEX idx_shifts_date ON shifts(shift_date);

-- Auto-Update updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weekly_schedules_updated_at
  BEFORE UPDATE ON weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- 4. RLS-Policies
-- =====================================================
ALTER TABLE shift_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts             ENABLE ROW LEVEL SECURITY;

-- Helper: ist aktueller User Admin?
CREATE OR REPLACE FUNCTION is_admin_user() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- shift_templates: Admin voll, alle authenticated users SELECT
CREATE POLICY "st_admin_all" ON shift_templates FOR ALL
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "st_auth_read" ON shift_templates FOR SELECT
  TO authenticated USING (is_active = true);

-- weekly_schedules: Admin voll, andere nur published
CREATE POLICY "ws_admin_all" ON weekly_schedules FOR ALL
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "ws_auth_read_published" ON weekly_schedules FOR SELECT
  TO authenticated USING (status = 'published');

-- shifts: Admin voll, MFA/Arzt nur eigene published shifts (bzw. alle published für Arzt)
CREATE POLICY "shifts_admin_all" ON shifts FOR ALL
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "shifts_mfa_own_published" ON shifts FOR SELECT
  TO authenticated USING (
    staff_member_id = auth.uid()
    AND EXISTS (SELECT 1 FROM weekly_schedules ws WHERE ws.id = weekly_schedule_id AND ws.status = 'published')
  );
CREATE POLICY "shifts_arzt_read_published" ON shifts FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE id = auth.uid() AND role = 'arzt' AND is_active = true
    )
    AND EXISTS (SELECT 1 FROM weekly_schedules ws WHERE ws.id = weekly_schedule_id AND ws.status = 'published')
  );

-- =====================================================
-- 5. Seed: Standard-Schichtvorlagen
-- =====================================================
INSERT INTO shift_templates (name, start_time, end_time, ends_with_closing, color, sort_order) VALUES
  ('Früh',         '07:30', '13:00', false, '#60A5FA', 10),
  ('Spät',         '12:00', NULL,    true,  '#F59E0B', 20),
  ('Mittelschicht','09:30', '15:00', false, '#10B981', 30),
  ('Ganztags',     '07:45', '16:00', false, '#8B5CF6', 40),
  ('Halbtags AM',  '08:00', '12:00', false, '#34D399', 50),
  ('Halbtags PM',  '13:00', '17:00', false, '#FB923C', 60);
