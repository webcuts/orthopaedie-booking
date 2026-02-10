import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Appointment, TimeSlot, TreatmentType } from '../../types/database';

// Extended appointment type with joined data
export interface AppointmentWithDetails extends Appointment {
  patient: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  treatment_type: {
    id: string;
    name: string;
    duration_minutes: number;
  };
  time_slot: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
  };
  practitioner?: {
    id: string;
    title: string | null;
    first_name: string;
    last_name: string;
  } | null;
  insurance_type?: {
    id: string;
    name: string;
  };
}

type CalendarView = 'day' | 'week' | 'month';

// Hook: Appointments für Kalenderansicht
export function useAppointments(date: Date, view: CalendarView) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let startDate: string;
      let endDate: string;

      if (view === 'day') {
        startDate = date.toISOString().split('T')[0];
        endDate = startDate;
      } else if (view === 'week') {
        const dayOfWeek = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        startDate = monday.toISOString().split('T')[0];
        endDate = sunday.toISOString().split('T')[0];
      } else {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
      }

      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(id, name, email, phone),
          treatment_type:treatment_types(id, name, duration_minutes),
          time_slot:time_slots!inner(id, date, start_time, end_time),
          practitioner:practitioners(id, title, first_name, last_name)
        `)
        .gte('time_slot.date', startDate)
        .lte('time_slot.date', endDate)
        .order('time_slot(date)', { ascending: true });

      if (fetchError) throw fetchError;

      setAppointments(data as AppointmentWithDetails[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Termine');
    } finally {
      setLoading(false);
    }
  }, [date, view]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return { appointments, loading, error, refetch: fetchAppointments };
}

// Hook: Einzelner Termin mit Details
export function useAppointmentDetails(appointmentId: string | null) {
  const [appointment, setAppointment] = useState<AppointmentWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) {
      setAppointment(null);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('appointments')
          .select(`
            *,
            patient:patients(id, name, email, phone, insurance_type_id),
            treatment_type:treatment_types(id, name, duration_minutes),
            time_slot:time_slots(id, date, start_time, end_time),
            practitioner:practitioners(id, title, first_name, last_name)
          `)
          .eq('id', appointmentId)
          .single();

        if (fetchError) throw fetchError;

        // Fetch insurance type separately
        if (data?.patient?.insurance_type_id) {
          const { data: insurance } = await supabase
            .from('insurance_types')
            .select('id, name')
            .eq('id', data.patient.insurance_type_id)
            .single();

          if (insurance) {
            (data as any).insurance_type = insurance;
          }
        }

        setAppointment(data as AppointmentWithDetails);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [appointmentId]);

  return { appointment, loading, error };
}

// Hook: Termin-Status ändern
export function useUpdateAppointmentStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(async (
    appointmentId: string,
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      // If cancelled, free up the time slot
      if (status === 'cancelled') {
        const { data: appointment } = await supabase
          .from('appointments')
          .select('time_slot_id')
          .eq('id', appointmentId)
          .single();

        if (appointment) {
          await supabase
            .from('time_slots')
            .update({ is_available: true })
            .eq('id', appointment.time_slot_id);
        }
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateStatus, loading, error };
}

// Hook: Zeitslots für einen Tag (für Sperrung)
export function useAdminTimeSlots(date: string | null) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!date) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('time_slots')
        .select('*')
        .eq('date', date)
        .order('start_time', { ascending: true });

      if (fetchError) throw fetchError;
      setSlots(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return { slots, loading, error, refetch: fetchSlots };
}

// Hook: Slot sperren/freigeben
export function useBlockSlot() {
  const [loading, setLoading] = useState(false);

  const toggleSlot = useCallback(async (slotId: string, isAvailable: boolean) => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('time_slots')
        .update({ is_available: isAvailable })
        .eq('id', slotId);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Fehler' };
    } finally {
      setLoading(false);
    }
  }, []);

  return { toggleSlot, loading };
}

// Hook: Behandlungsarten CRUD
export function useTreatmentTypes() {
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTreatmentTypes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('treatment_types')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setTreatmentTypes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTreatmentTypes();
  }, [fetchTreatmentTypes]);

  const createTreatmentType = useCallback(async (
    data: { name: string; duration_minutes: number; description?: string }
  ) => {
    const { error } = await supabase
      .from('treatment_types')
      .insert([{ ...data, is_active: true }]);

    if (error) return { success: false, error: error.message };
    await fetchTreatmentTypes();
    return { success: true };
  }, [fetchTreatmentTypes]);

  const updateTreatmentType = useCallback(async (
    id: string,
    data: Partial<TreatmentType>
  ) => {
    const { error } = await supabase
      .from('treatment_types')
      .update(data)
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    await fetchTreatmentTypes();
    return { success: true };
  }, [fetchTreatmentTypes]);

  const deleteTreatmentType = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('treatment_types')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    await fetchTreatmentTypes();
    return { success: true };
  }, [fetchTreatmentTypes]);

  return {
    treatmentTypes,
    loading,
    error,
    createTreatmentType,
    updateTreatmentType,
    deleteTreatmentType,
    refetch: fetchTreatmentTypes,
  };
}

// Hook: Slots generieren
export function useGenerateSlots() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ slots_created: number; period: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSlots = useCallback(async (weeksAhead: number = 4) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call the SQL function directly
      const { data, error: rpcError } = await supabase
        .rpc('generate_time_slots_with_log', {
          weeks_ahead: weeksAhead,
          triggered_by: 'admin_dashboard'
        });

      if (rpcError) throw rpcError;

      const resultData = data?.[0] || { slots_created: 0, period: 'N/A' };
      setResult(resultData);
      return { success: true, data: resultData };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Slot-Generierung';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateSlots, loading, result, error };
}

// =====================================================
// Hook: Behandler-Abwesenheiten
// =====================================================

export interface PractitionerAbsence {
  id: string;
  practitioner_id: string;
  start_date: string;
  end_date: string;
  reason: 'sick' | 'vacation' | 'other';
  note: string | null;
  created_at: string;
  practitioner?: {
    id: string;
    title: string | null;
    first_name: string;
    last_name: string;
  };
}

export interface Practitioner {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  specialty_id: string;
  is_active: boolean;
}

// Hook: Admin-Buchung erstellen
export function useAdminCreateBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useCallback(async (data: {
    practitionerId: string;
    timeSlotId: string;
    treatmentTypeId: string;
    insuranceTypeId: string;
    patientName: string;
    patientEmail?: string;
    patientPhone?: string;
    notes?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create patient
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          name: data.patientName,
          email: data.patientEmail || null,
          phone: data.patientPhone || null,
          insurance_type_id: data.insuranceTypeId,
        })
        .select()
        .single();

      if (patientError) throw patientError;

      // 2. Create appointment (UNIQUE constraint prevents double-booking)
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patient.id,
          treatment_type_id: data.treatmentTypeId,
          time_slot_id: data.timeSlotId,
          practitioner_id: data.practitionerId,
          notes: data.notes || null,
          status: 'confirmed',
        })
        .select()
        .single();

      if (appointmentError) {
        if (appointmentError.code === '23505') {
          throw new Error('Dieser Zeitslot ist für den gewählten Behandler bereits vergeben.');
        }
        throw appointmentError;
      }

      // 3. Send confirmation email only if email was provided
      if (data.patientEmail) {
        supabase.functions.invoke('send-booking-confirmation', {
          body: { appointmentId: appointment.id },
        }).then(({ error }) => {
          if (error) console.error('Fehler beim Senden der Bestätigung:', error);
        });
      }

      // 4. Send practice notification
      supabase.functions.invoke('send-practice-notification', {
        body: { appointmentId: appointment.id },
      }).then(({ error }) => {
        if (error) console.error('Fehler beim Senden der Praxis-Benachrichtigung:', error);
      });

      return { success: true, appointmentId: appointment.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Buchung';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { createBooking, loading, error, clearError };
}

// Hook: Verfügbare Slots für Admin (per Behandler)
export function useAdminAvailableSlots(date: string | null, practitionerId: string | null) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date || !practitionerId) {
      setSlots([]);
      return;
    }

    async function fetch() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .rpc('get_available_slots', {
            p_date: date,
            p_practitioner_id: practitionerId,
          });

        if (error) throw error;
        setSlots(data || []);
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [date, practitionerId]);

  return { slots, loading };
}

export function usePractitionerAbsences() {
  const [absences, setAbsences] = useState<PractitionerAbsence[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAbsences = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Lade aktive und zukünftige Abwesenheiten
      const { data, error: absError } = await supabase
        .from('practitioner_absences')
        .select(`
          *,
          practitioner:practitioners(id, title, first_name, last_name)
        `)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('start_date');

      if (absError) throw absError;
      setAbsences(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Abwesenheiten');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPractitioners = useCallback(async () => {
    const { data, error } = await supabase
      .from('practitioners')
      .select('*')
      .eq('is_active', true)
      .order('last_name');

    if (!error && data) {
      setPractitioners(data);
    }
  }, []);

  useEffect(() => {
    fetchAbsences();
    fetchPractitioners();
  }, [fetchAbsences, fetchPractitioners]);

  const createAbsence = useCallback(async (data: {
    practitioner_id: string;
    start_date: string;
    end_date: string;
    reason: 'sick' | 'vacation' | 'other';
    note?: string;
  }) => {
    const { error } = await supabase
      .from('practitioner_absences')
      .insert(data);

    if (error) return { success: false, error: error.message };
    await fetchAbsences();
    return { success: true };
  }, [fetchAbsences]);

  const deleteAbsence = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('practitioner_absences')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    await fetchAbsences();
    return { success: true };
  }, [fetchAbsences]);

  return {
    absences,
    practitioners,
    loading,
    error,
    createAbsence,
    deleteAbsence,
    refetch: fetchAbsences,
  };
}

// =====================================================
// Hook: Patientendaten anonymisieren (DSGVO)
// =====================================================

export function useAnonymizePatient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anonymize = useCallback(async (patientId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase
        .rpc('anonymize_patient', { p_patient_id: patientId });

      if (rpcError) throw rpcError;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Anonymisieren';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { anonymize, loading, error };
}

// =====================================================
// Hook: System-Logs (Monitoring)
// =====================================================

export interface SystemLog {
  id: string;
  event_type: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function useSystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}
