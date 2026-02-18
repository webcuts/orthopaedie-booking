-- =====================================================
-- Bugfix: Doppelte Stoßwellentherapie + Sortierung
-- 1. Doppelten Stoßwellentherapie-Eintrag deaktivieren
-- 2. sort_order anpassen: Erstuntersuchung=1, Sprechstunde=2, Stoßwellentherapie=3
-- 3. Rezepte deaktivieren (nur MFA-Leistung, siehe ORTHO-041)
-- =====================================================

-- Doppelte Stoßwellentherapie: nur den neuesten aktiv lassen
-- Deaktiviere alle bis auf den mit der niedrigsten ID
UPDATE treatment_types
SET is_active = false
WHERE name = 'Stoßwellentherapie'
  AND id != (
    SELECT id FROM treatment_types
    WHERE name = 'Stoßwellentherapie'
    ORDER BY id ASC
    LIMIT 1
  );

-- Sortierung festlegen
UPDATE treatment_types SET sort_order = 1 WHERE name = 'Erstuntersuchung Neupatient' AND is_active = true;
UPDATE treatment_types SET sort_order = 2 WHERE name = 'Sprechstunde' AND is_active = true;
UPDATE treatment_types SET sort_order = 3 WHERE name = 'Stoßwellentherapie' AND is_active = true;

-- Rezepte deaktivieren (ist ausschließlich MFA-Leistung)
UPDATE treatment_types SET is_active = false WHERE name = 'Rezepte';
