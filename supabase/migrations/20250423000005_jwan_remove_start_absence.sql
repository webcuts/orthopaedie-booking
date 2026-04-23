-- =====================================================
-- Korrektur: Die "Startet am 04.05."-Abwesenheit blockierte
-- im Frontend die komplette Auswahl von Jwan Mohammed.
-- Der Wunsch war aber: Jwan ist JETZT sichtbar und für
-- zukünftige Termine (z.B. 25.05.) direkt buchbar.
--
-- Lösung: Abwesenheit entfernen. Jwan ist damit voll buchbar.
-- =====================================================

DELETE FROM practitioner_absences
WHERE practitioner_id = (SELECT id FROM practitioners WHERE last_name='Mohammed')
  AND end_date = '2026-05-03'
  AND reason = 'other';
