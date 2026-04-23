-- =====================================================
-- Jwan Mohammed sofort im Widget sichtbar machen.
-- Abwesenheit bis 03.05.2026 blockiert konkrete Buchungen,
-- sodass der erste buchbare Tag Montag 04.05.2026 ist.
-- =====================================================

UPDATE practitioners
SET available_from = NULL
WHERE last_name = 'Mohammed';

INSERT INTO practitioner_absences (
  practitioner_id, start_date, end_date, reason, show_on_website, public_message
)
SELECT
  id, CURRENT_DATE, '2026-05-03', 'other', true,
  'Jwan Mohammed beginnt am 04. Mai. Termine ab dann buchbar.'
FROM practitioners
WHERE last_name = 'Mohammed'
  AND NOT EXISTS (
    SELECT 1 FROM practitioner_absences
    WHERE practitioner_id = practitioners.id
      AND start_date = CURRENT_DATE
      AND end_date = '2026-05-03'
  );
