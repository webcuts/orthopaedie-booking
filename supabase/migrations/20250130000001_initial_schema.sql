-- =====================================================
-- ORTHO-001: Datenbankstruktur für Terminbuchungssystem
-- Orthopädische Praxis Königstraße, Hannover
-- =====================================================

-- Status-Enum für Termine
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- =====================================================
-- Tabelle: insurance_types (Versicherungsarten)
-- =====================================================
CREATE TABLE insurance_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE insurance_types IS 'Versicherungsarten (Gesetzlich, Privat, Selbstzahler)';

-- =====================================================
-- Tabelle: patients (Patienten)
-- =====================================================
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    insurance_type_id UUID NOT NULL REFERENCES insurance_types(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_insurance_type ON patients(insurance_type_id);

COMMENT ON TABLE patients IS 'Patientendaten für Terminbuchungen';

-- =====================================================
-- Tabelle: treatment_types (Behandlungsarten)
-- =====================================================
CREATE TABLE treatment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE treatment_types IS 'Verfügbare Behandlungsarten der Praxis';

-- =====================================================
-- Tabelle: time_slots (Zeitfenster)
-- =====================================================
CREATE TABLE time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_time_slots_date ON time_slots(date);
CREATE INDEX idx_time_slots_available ON time_slots(date, is_available) WHERE is_available = true;

COMMENT ON TABLE time_slots IS 'Verfügbare Zeitfenster für Terminbuchungen';

-- =====================================================
-- Tabelle: appointments (Termine)
-- =====================================================
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    treatment_type_id UUID NOT NULL REFERENCES treatment_types(id),
    time_slot_id UUID NOT NULL REFERENCES time_slots(id),
    status appointment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_time_slot UNIQUE (time_slot_id)
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_time_slot ON appointments(time_slot_id);

COMMENT ON TABLE appointments IS 'Gebuchte Termine mit Status-Tracking';

-- =====================================================
-- Trigger: updated_at automatisch aktualisieren
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security aktivieren
-- =====================================================
ALTER TABLE insurance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies: Öffentlicher Lesezugriff für Widget
-- =====================================================

-- Insurance Types: Öffentlich lesbar (für Widget-Auswahl)
CREATE POLICY "insurance_types_public_read" ON insurance_types
    FOR SELECT
    USING (is_active = true);

-- Treatment Types: Öffentlich lesbar (für Widget-Auswahl)
CREATE POLICY "treatment_types_public_read" ON treatment_types
    FOR SELECT
    USING (is_active = true);

-- Time Slots: Öffentlich lesbar (für Kalenderansicht)
CREATE POLICY "time_slots_public_read" ON time_slots
    FOR SELECT
    USING (true);

-- =====================================================
-- RLS Policies: Anonyme Inserts für Buchungen
-- =====================================================

-- Patients: Anonyme können sich selbst anlegen
CREATE POLICY "patients_anon_insert" ON patients
    FOR INSERT
    WITH CHECK (true);

-- Appointments: Anonyme können Termine buchen
CREATE POLICY "appointments_anon_insert" ON appointments
    FOR INSERT
    WITH CHECK (true);

-- Time Slots: Update für Verfügbarkeit bei Buchung
CREATE POLICY "time_slots_anon_update" ON time_slots
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- RLS Policies: Service Role für Admin-Dashboard
-- (Service Role umgeht RLS automatisch)
-- =====================================================

-- Für authentifizierte Admins: Vollzugriff
CREATE POLICY "insurance_types_admin_all" ON insurance_types
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "patients_admin_all" ON patients
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "treatment_types_admin_all" ON treatment_types
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "time_slots_admin_all" ON time_slots
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "appointments_admin_all" ON appointments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- Basis-Daten: Versicherungsarten
-- =====================================================
INSERT INTO insurance_types (name, is_active) VALUES
    ('Gesetzlich versichert', true),
    ('Privat versichert', true),
    ('Selbstzahler', true);

-- =====================================================
-- Beispiel-Behandlungsarten (können im Admin angepasst werden)
-- =====================================================
INSERT INTO treatment_types (name, duration_minutes, description, is_active) VALUES
    ('Erstberatung', 30, 'Erstgespräch und Anamnese für neue Patienten', true),
    ('Kontrolluntersuchung', 15, 'Routinemäßige Nachkontrolle', true),
    ('Manuelle Therapie', 30, 'Manuelle Behandlung von Gelenken und Muskeln', true),
    ('Röntgenbesprechung', 15, 'Besprechung von Röntgenbildern', true),
    ('Injektionstherapie', 20, 'Lokale Injektionsbehandlung', true);
