-- Jwan Mohammed deaktivieren
UPDATE practitioners
SET is_active = false
WHERE first_name = 'Jwan' AND last_name = 'Mohammed';
