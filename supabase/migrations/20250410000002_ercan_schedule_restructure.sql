-- =====================================================
-- ORTHO-054: Sprechzeiten Dr. Ercan — Komplette Neustrukturierung
-- Alte Einträge werden per valid_until beendet, neue eingefügt
-- =====================================================

DO $$
DECLARE
    v_ercan_id UUID;
BEGIN
    SELECT id INTO v_ercan_id
    FROM practitioners
    WHERE last_name = 'Ercan' AND is_active = true
    LIMIT 1;

    IF v_ercan_id IS NULL THEN
        RAISE NOTICE 'Dr. Ercan not found, skipping schedule update';
        RETURN;
    END IF;

    -- Alte Einträge beenden (auf gestern setzen, damit sie nicht mehr geladen werden)
    UPDATE practitioner_schedules
    SET valid_until = CURRENT_DATE - INTERVAL '1 day'
    WHERE practitioner_id = v_ercan_id
      AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

    -- Neue Einträge einfügen
    INSERT INTO practitioner_schedules
        (practitioner_id, day_of_week, start_time, end_time, is_bookable, insurance_filter, label, valid_from, valid_until)
    VALUES
        -- Montag (1): OP morgens (nicht buchbar), Nachmittag Sprechstunde (buchbar)
        (v_ercan_id, 1, '07:30', '13:00', false, 'all', 'OP-Tag', CURRENT_DATE, NULL),
        (v_ercan_id, 1, '13:30', '16:30', true,  'all', 'Sprechstunde', CURRENT_DATE, NULL),

        -- Dienstag (2): Offene Sprechstunde ganztägig (nicht online buchbar)
        (v_ercan_id, 2, '09:00', '14:30', false, 'all', 'Offene Sprechstunde', CURRENT_DATE, NULL),

        -- Mittwoch (3): Ganztägig OP (nicht buchbar)
        (v_ercan_id, 3, '07:30', '18:00', false, 'all', 'OP-Tag', CURRENT_DATE, NULL),

        -- Donnerstag (4): Offene Sprechstunde ganztägig (nicht online buchbar)
        (v_ercan_id, 4, '09:00', '14:30', false, 'all', 'Offene Sprechstunde', CURRENT_DATE, NULL),

        -- Freitag (5): Ganztägig Sprechstunde für alle Versicherungstypen
        (v_ercan_id, 5, '07:45', '16:00', true,  'all', 'Sprechstunde', CURRENT_DATE, NULL);
END $$;
