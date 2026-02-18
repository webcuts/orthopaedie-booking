-- =====================================================
-- ORTHO-041: Rezepte aus Arzt-Behandlungsarten entfernen
-- Rezepte ist ausschließlich MFA-Leistung (Rezeptvergabe)
-- Bestehende Termine bleiben erhalten
-- =====================================================

UPDATE treatment_types SET is_active = false WHERE name = 'Rezepte';
