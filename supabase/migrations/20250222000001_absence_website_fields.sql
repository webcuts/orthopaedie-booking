-- =====================================================
-- ORTHO-034: Abwesenheits-Popup auf Website
-- Neue Spalten für Website-Anzeige + RLS anpassen
-- =====================================================

-- Neue Spalten
ALTER TABLE practitioner_absences ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE practitioner_absences ADD COLUMN IF NOT EXISTS public_message TEXT;

-- RLS-Policy für anon aktualisieren: nur show_on_website=true
DROP POLICY IF EXISTS "Anon can view active absences" ON practitioner_absences;

CREATE POLICY "Anon can view active absences"
  ON practitioner_absences FOR SELECT
  TO anon
  USING (
    show_on_website = true
    AND start_date <= CURRENT_DATE + INTERVAL '90 days'
    AND end_date >= CURRENT_DATE
  );
