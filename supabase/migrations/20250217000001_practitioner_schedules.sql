-- =====================================================
-- ORTHO-028: Individuelle Sprechzeiten pro Behandler
-- Neue Tabelle practitioner_schedules + Seed-Daten Dr. Ercan
-- =====================================================

-- 1. Tabelle erstellen
CREATE TABLE practitioner_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    -- JS getDay() Konvention: 0=Sonntag, 1=Montag, ..., 6=Samstag
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_bookable BOOLEAN NOT NULL DEFAULT false,
    insurance_filter TEXT NOT NULL DEFAULT 'all' CHECK (insurance_filter IN ('all', 'private_only')),
    label TEXT,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_time_range CHECK (start_time < end_time),
    CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX idx_ps_practitioner ON practitioner_schedules(practitioner_id);
CREATE INDEX idx_ps_lookup ON practitioner_schedules(practitioner_id, day_of_week, is_bookable);

-- 2. RLS Policies
ALTER TABLE practitioner_schedules ENABLE ROW LEVEL SECURITY;

-- Anon: SELECT (Booking Widget muss Schedules laden können)
CREATE POLICY "practitioner_schedules_anon_read"
    ON practitioner_schedules FOR SELECT
    TO anon
    USING (true);

-- Authenticated: Full Access (Admin Dashboard)
CREATE POLICY "practitioner_schedules_auth_read"
    ON practitioner_schedules FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "practitioner_schedules_auth_insert"
    ON practitioner_schedules FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "practitioner_schedules_auth_update"
    ON practitioner_schedules FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "practitioner_schedules_auth_delete"
    ON practitioner_schedules FOR DELETE
    TO authenticated
    USING (true);

-- 3. Seed-Daten Dr. Ercan (gültig bis August 2026)
DO $$
DECLARE
    v_ercan_id UUID;
BEGIN
    SELECT id INTO v_ercan_id
    FROM practitioners
    WHERE last_name = 'Ercan' AND is_active = true
    LIMIT 1;

    IF v_ercan_id IS NULL THEN
        RAISE NOTICE 'Dr. Ercan not found, skipping seed data';
        RETURN;
    END IF;

    INSERT INTO practitioner_schedules
        (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
    VALUES
        -- Montag (1): OP-Tag
        (v_ercan_id, 1, '07:30', '13:00', false, 'all', 'OP-Tag Kurt-Schumacher-Str.', CURRENT_DATE, '2026-08-31'),
        -- Dienstag (2): Offene Sprechstunde + Sprechstunde
        (v_ercan_id, 2, '09:30', '12:30', false, 'all', 'Offene Sprechstunde', CURRENT_DATE, '2026-08-31'),
        (v_ercan_id, 2, '12:40', '14:30', true,  'all', 'Sprechstunde', CURRENT_DATE, '2026-08-31'),
        -- Mittwoch (3): Verwaltung + OP-Tag
        (v_ercan_id, 3, '07:30', '12:00', false, 'all', 'Verwaltung', CURRENT_DATE, '2026-08-31'),
        (v_ercan_id, 3, '12:30', '18:00', false, 'all', 'OP-Tag Sophienklinik', CURRENT_DATE, '2026-08-31'),
        -- Donnerstag (4): Offene Sprechstunde + Sprechstunde
        (v_ercan_id, 4, '09:30', '12:30', false, 'all', 'Offene Sprechstunde', CURRENT_DATE, '2026-08-31'),
        (v_ercan_id, 4, '12:40', '14:30', true,  'all', 'Sprechstunde', CURRENT_DATE, '2026-08-31'),
        -- Freitag (5): Sprechstunde + Privatsprechstunde
        (v_ercan_id, 5, '07:30', '12:30', true,  'all', 'Sprechstunde', CURRENT_DATE, '2026-08-31'),
        (v_ercan_id, 5, '13:00', '16:00', true,  'private_only', 'Privatsprechstunde', CURRENT_DATE, '2026-08-31');
END $$;
