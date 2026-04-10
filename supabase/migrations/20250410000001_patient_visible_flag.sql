-- =====================================================
-- ORTHO-057: IGeL-Leistungen aus Patientenbuchung entfernen
-- Neue Spalte patient_visible steuert Sichtbarkeit im Buchungswidget
-- MFA-intern bleiben alle Behandlungstypen verfügbar
-- =====================================================

-- Spalte für Arzt-Behandlungstypen
ALTER TABLE treatment_types
ADD COLUMN patient_visible BOOLEAN NOT NULL DEFAULT true;

-- Spalte für MFA-Behandlungstypen
ALTER TABLE mfa_treatment_types
ADD COLUMN patient_visible BOOLEAN NOT NULL DEFAULT true;

-- IGeL-Leistungen für Patienten verstecken
-- (PRP, Hyaluronsäure, Knochendichte, TENS sind nur MFA-intern buchbar)
UPDATE mfa_treatment_types
SET patient_visible = false
WHERE name IN (
  'PRP-Behandlung',
  'Hyaluronsäure-Behandlung',
  'Knochendichte-Messung',
  'TENS-Behandlung'
);

-- Kommentar zur Dokumentation
COMMENT ON COLUMN treatment_types.patient_visible IS 'Ob dieser Behandlungstyp im Patienten-Buchungswidget sichtbar ist';
COMMENT ON COLUMN mfa_treatment_types.patient_visible IS 'Ob dieser MFA-Behandlungstyp im Patienten-Buchungswidget sichtbar ist';
