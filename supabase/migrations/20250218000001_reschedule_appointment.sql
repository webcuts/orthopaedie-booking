-- =====================================================
-- ORTHO-031: Terminverlegung (Reschedule)
-- Atomare RPC-Funktionen für Arzt- und MFA-Termine
-- =====================================================

-- 1. Arzt-Termin verlegen (inkl. Multi-Slot)
CREATE OR REPLACE FUNCTION reschedule_appointment(
  p_appointment_id UUID,
  p_new_time_slot_id UUID,
  p_additional_slot_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment RECORD;
  v_old_slot_id UUID;
  v_new_slot RECORD;
  v_additional_id UUID;
  v_linked RECORD;
  v_new_deadline TIMESTAMPTZ;
  v_new_slot_datetime TIMESTAMPTZ;
BEGIN
  -- 1. Aktuellen Termin laden
  SELECT a.*, ts.date AS old_date, ts.start_time AS old_time
  INTO v_appointment
  FROM appointments a
  JOIN time_slots ts ON a.time_slot_id = ts.id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termin nicht gefunden';
  END IF;

  IF v_appointment.status = 'cancelled' THEN
    RAISE EXCEPTION 'Stornierte Termine können nicht verlegt werden';
  END IF;

  v_old_slot_id := v_appointment.time_slot_id;

  -- 2. Neuen Slot laden und prüfen
  SELECT * INTO v_new_slot FROM time_slots WHERE id = p_new_time_slot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Neuer Zeitslot nicht gefunden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE time_slot_id = p_new_time_slot_id
      AND practitioner_id = v_appointment.practitioner_id
      AND status != 'cancelled'
      AND id != p_appointment_id
  ) THEN
    RAISE EXCEPTION 'Neuer Zeitslot ist bereits belegt';
  END IF;

  -- 3. Alten Primary-Slot freigeben
  UPDATE time_slots SET is_available = true WHERE id = v_old_slot_id;

  -- 4. Verknüpfte Secondary-Appointments stornieren + Slots freigeben
  FOR v_linked IN
    SELECT id, time_slot_id FROM appointments
    WHERE primary_appointment_id = p_appointment_id
      AND status != 'cancelled'
  LOOP
    UPDATE appointments SET status = 'cancelled' WHERE id = v_linked.id;
    UPDATE time_slots SET is_available = true WHERE id = v_linked.time_slot_id;
  END LOOP;

  -- 5. Primary-Appointment updaten
  v_new_slot_datetime := (v_new_slot.date + v_new_slot.start_time)::TIMESTAMPTZ;
  v_new_deadline := v_new_slot_datetime - INTERVAL '12 hours';

  UPDATE appointments
  SET time_slot_id = p_new_time_slot_id,
      cancellation_deadline = v_new_deadline,
      updated_at = NOW()
  WHERE id = p_appointment_id;

  -- 6. Neue Secondary-Appointments erstellen (Multi-Slot)
  IF array_length(p_additional_slot_ids, 1) > 0 THEN
    FOREACH v_additional_id IN ARRAY p_additional_slot_ids LOOP
      INSERT INTO appointments (
        patient_id, treatment_type_id, time_slot_id, practitioner_id,
        primary_appointment_id, status, language, consent_given, consent_timestamp
      ) VALUES (
        v_appointment.patient_id, v_appointment.treatment_type_id, v_additional_id,
        v_appointment.practitioner_id, p_appointment_id, 'confirmed',
        v_appointment.language, v_appointment.consent_given, v_appointment.consent_timestamp
      );
    END LOOP;
  END IF;

  -- 7. Alte ungesendete Reminder löschen, neue erstellen
  DELETE FROM email_reminders
  WHERE appointment_id = p_appointment_id
    AND sent_at IS NULL
    AND (booking_type IS NULL OR booking_type = 'doctor');

  INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for)
  VALUES
    (p_appointment_id, '24h_before', v_new_slot_datetime - INTERVAL '24 hours'),
    (p_appointment_id, '6h_before', v_new_slot_datetime - INTERVAL '6 hours');

  -- 8. System-Log
  INSERT INTO system_logs (event_type, message, details)
  VALUES (
    'reschedule',
    'Termin ' || p_appointment_id || ' verlegt',
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'old_slot_id', v_old_slot_id,
      'new_slot_id', p_new_time_slot_id,
      'old_date', v_appointment.old_date,
      'old_time', v_appointment.old_time,
      'new_date', v_new_slot.date,
      'new_time', v_new_slot.start_time
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_date', v_new_slot.date,
    'new_time', v_new_slot.start_time
  );
END;
$$;

-- 2. MFA-Termin verlegen
CREATE OR REPLACE FUNCTION reschedule_mfa_appointment(
  p_appointment_id UUID,
  p_new_mfa_slot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment RECORD;
  v_old_slot_id UUID;
  v_new_slot RECORD;
  v_new_slot_datetime TIMESTAMPTZ;
BEGIN
  -- 1. MFA-Termin laden
  SELECT ma.*, ms.date AS old_date, ms.start_time AS old_time
  INTO v_appointment
  FROM mfa_appointments ma
  JOIN mfa_time_slots ms ON ma.mfa_time_slot_id = ms.id
  WHERE ma.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MFA-Termin nicht gefunden';
  END IF;

  IF v_appointment.status = 'cancelled' THEN
    RAISE EXCEPTION 'Stornierte Termine können nicht verlegt werden';
  END IF;

  v_old_slot_id := v_appointment.mfa_time_slot_id;

  -- 2. Kapazität des neuen Slots prüfen
  SELECT * INTO v_new_slot FROM mfa_time_slots WHERE id = p_new_mfa_slot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Neuer MFA-Zeitslot nicht gefunden';
  END IF;

  IF NOT check_mfa_slot_availability(p_new_mfa_slot_id) THEN
    RAISE EXCEPTION 'Neuer MFA-Zeitslot ist voll belegt';
  END IF;

  -- 3. Appointment updaten
  UPDATE mfa_appointments
  SET mfa_time_slot_id = p_new_mfa_slot_id,
      updated_at = NOW()
  WHERE id = p_appointment_id;

  -- 4. Alte ungesendete Reminder löschen, neue erstellen
  v_new_slot_datetime := (v_new_slot.date + v_new_slot.start_time)::TIMESTAMPTZ;

  DELETE FROM email_reminders
  WHERE appointment_id = p_appointment_id
    AND booking_type = 'mfa'
    AND sent_at IS NULL;

  INSERT INTO email_reminders (appointment_id, reminder_type, scheduled_for, booking_type)
  VALUES
    (p_appointment_id, '24h_before', v_new_slot_datetime - INTERVAL '24 hours', 'mfa'),
    (p_appointment_id, '6h_before', v_new_slot_datetime - INTERVAL '6 hours', 'mfa');

  -- 5. System-Log
  INSERT INTO system_logs (event_type, message, details)
  VALUES (
    'reschedule',
    'MFA-Termin ' || p_appointment_id || ' verlegt',
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'old_slot_id', v_old_slot_id,
      'new_slot_id', p_new_mfa_slot_id,
      'old_date', v_appointment.old_date,
      'old_time', v_appointment.old_time,
      'new_date', v_new_slot.date,
      'new_time', v_new_slot.start_time,
      'type', 'mfa'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_date', v_new_slot.date,
    'new_time', v_new_slot.start_time
  );
END;
$$;

-- Berechtigungen (nur authentifizierte Admin-User)
GRANT EXECUTE ON FUNCTION reschedule_appointment(UUID, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION reschedule_mfa_appointment(UUID, UUID) TO authenticated;
