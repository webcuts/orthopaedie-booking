-- =====================================================
-- ORTHO-044: Rezeptvorbestellung als eigenständiger Bereich
-- =====================================================

-- 1. Neue Tabelle für Rezeptvorbestellungen
CREATE TABLE IF NOT EXISTS prescription_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  order_type TEXT NOT NULL CHECK (order_type IN ('rezept', 'heilmittel', 'ueberweisung')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'neu' CHECK (status IN ('neu', 'in_bearbeitung', 'erledigt')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id)
);

-- 2. RLS aktivieren
ALTER TABLE prescription_orders ENABLE ROW LEVEL SECURITY;

-- Anonymer Insert (Patienten können Bestellungen aufgeben)
CREATE POLICY "anon_insert_prescription_orders"
  ON prescription_orders FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated: Vollzugriff (Admin)
CREATE POLICY "auth_all_prescription_orders"
  ON prescription_orders FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated: Lesen
CREATE POLICY "auth_select_prescription_orders"
  ON prescription_orders FOR SELECT TO authenticated
  USING (true);

-- 3. Rezeptvergabe und Physiotherapie-Überweisung aus MFA-Track deaktivieren
-- (nur Leistungen mit festem Termin bleiben: Knochendichtemessung, PHP-Behandlung)
UPDATE mfa_treatment_types
SET is_active = false
WHERE name IN ('Rezeptvergabe', 'Physiotherapie-Überweisung');

-- 4. Index für häufige Abfragen
CREATE INDEX IF NOT EXISTS idx_prescription_orders_status ON prescription_orders(status);
CREATE INDEX IF NOT EXISTS idx_prescription_orders_created ON prescription_orders(created_at DESC);
