-- =====================================================
-- Migration 012: Rate Limiting für Buchungen
-- Verhindert Spam-Buchungen über das öffentliche Widget
-- =====================================================

-- Funktion: Prüft ob eine E-Mail-Adresse in den letzten 24h
-- bereits 3+ Buchungen erstellt hat
CREATE OR REPLACE FUNCTION check_booking_rate_limit(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) < 3
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  WHERE p.email = p_email
    AND a.created_at > NOW() - INTERVAL '24 hours';
$$;

-- Anon darf die Funktion aufrufen (wird vor INSERT geprüft)
GRANT EXECUTE ON FUNCTION check_booking_rate_limit(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_booking_rate_limit(TEXT) TO authenticated;
