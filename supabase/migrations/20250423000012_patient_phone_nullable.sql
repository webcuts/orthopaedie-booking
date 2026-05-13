-- =====================================================
-- Migration: patients.phone Spalte nullable machen
-- =====================================================
-- Vorherige Migration 20250423000011 hat den CHECK-Constraint korrigiert
-- aber die NOT NULL Constraint auf Column-Ebene blieb. Heißt: das Frontend
-- (das phone optional behandelt) lief immer noch in "null value in column phone"
-- Error.

ALTER TABLE patients ALTER COLUMN phone DROP NOT NULL;

-- Verifikation
DO $$
DECLARE
  v_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='patients' AND column_name='phone';

  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION 'phone ist immer noch NOT NULL';
  END IF;

  RAISE NOTICE 'patients.phone ist jetzt nullable.';
END $$;
