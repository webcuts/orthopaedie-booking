import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Appointment, TimeSlot, TreatmentType, MfaTreatmentType } from '../../types/database';

// Extended appointment type with joined data
export interface AppointmentWithDetails extends Appointment {
  patient: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
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
  // MFA discriminator
  bookingType?: 'doctor' | 'mfa';
}

type CalendarView = 'day' | 'columns' | 'week' | 'month';

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
        .lte('time_slot.date', endDate);

      if (fetchError) throw fetchError;

      // Sort client-side (PostgREST foreign table order syntax unreliable)
      const sorted = (data as AppointmentWithDetails[]).sort((a, b) => {
        const dateA = a.time_slot?.date || '';
        const dateB = b.time_slot?.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.time_slot?.start_time || '').localeCompare(b.time_slot?.start_time || '');
      });

      setAppointments(sorted);
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

      // If cancelled, free up the time slot and notify patient (ORTHO-040)
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

        // Absage-Benachrichtigung senden (E-Mail oder SMS)
        supabase.functions.invoke('send-cancellation-notification', {
          body: { appointmentId },
        }).then(({ error }) => {
          if (error) console.error('Fehler beim Senden der Absage-Benachrichtigung:', error);
        });
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
  show_on_website: boolean;
  public_message: string | null;
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
    existingPatientId?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Use existing patient or create new
      let patient: { id: string };
      if (data.existingPatientId) {
        patient = { id: data.existingPatientId };
        // Optional: Update contact info if provided (e.g., MFA corrected Doctolib placeholder phone)
        if (data.patientPhone || data.patientEmail) {
          await supabase
            .from('patients')
            .update({
              ...(data.patientPhone ? { phone: data.patientPhone } : {}),
              ...(data.patientEmail ? { email: data.patientEmail } : {}),
            })
            .eq('id', data.existingPatientId);
        }
      } else {
        const { data: newPatient, error: patientError } = await supabase
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
        patient = newPatient;
      }

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

      // 3. Send confirmation email/SMS if contact info was provided (ORTHO-040)
      if (data.patientEmail || data.patientPhone) {
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

// Hook: Verfügbare Slots für Admin (per Behandler) — schedule-aware (nur Slots
// die in einer is_bookable Sprechzeit liegen, mit 09:00-Cap).
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
          .rpc('get_admin_available_slots', {
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

// Hook: Nächste N freien Slots des Behandlers (für "Nächster freier Termin"-Schnellauswahl)
export interface NextSlot extends TimeSlot {
  date: string;
}
export function useAdminNextFreeSlots(practitionerId: string | null, count: number = 4) {
  const [slots, setSlots] = useState<NextSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!practitionerId) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    supabase
      .rpc('get_next_admin_slots', {
        p_practitioner_id: practitionerId,
        p_count: count,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setSlots([]);
        } else {
          setSlots(data as NextSlot[]);
        }
      })
      .then(null, () => {
        if (!cancelled) setSlots([]);
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [practitionerId, count]);

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
    show_on_website?: boolean;
    public_message?: string;
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

// =====================================================
// Hook: Analytics (ORTHO-022)
// =====================================================

export interface AnalyticsData {
  bookingsThisWeek: number;
  bookingsLastWeek: number;
  bookingsToday: number;
  hourlyDistribution: { hour: number; count: number }[];
  practitionerUtilization: { name: string; percentage: number }[];
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function useAnalytics(practitionerFilter?: string | null) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const thisMonday = getMonday(now);
      const thisMondayStr = thisMonday.toISOString().split('T')[0];
      const thisSunday = new Date(thisMonday);
      thisSunday.setDate(thisMonday.getDate() + 6);
      const thisSundayStr = thisSunday.toISOString().split('T')[0];

      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastMondayStr = lastMonday.toISOString().split('T')[0];
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      const lastSundayStr = lastSunday.toISOString().split('T')[0];

      // Optionaler Behandler-Filter (für Ärzte: nur eigene Daten)
      const filterApt = (q: any) =>
        practitionerFilter ? q.eq('practitioner_id', practitionerFilter) : q;

      // Parallel queries
      const [thisWeekRes, lastWeekRes, todayRes, allBookingsRes, practitionersRes] = await Promise.all([
        // Buchungen diese Woche
        filterApt(supabase
          .from('appointments')
          .select('id, time_slot:time_slots!inner(date)', { count: 'exact', head: true })
          .neq('status', 'cancelled')
          .gte('time_slot.date', thisMondayStr)
          .lte('time_slot.date', thisSundayStr)),

        // Buchungen letzte Woche
        filterApt(supabase
          .from('appointments')
          .select('id, time_slot:time_slots!inner(date)', { count: 'exact', head: true })
          .neq('status', 'cancelled')
          .gte('time_slot.date', lastMondayStr)
          .lte('time_slot.date', lastSundayStr)),

        // Buchungen heute
        filterApt(supabase
          .from('appointments')
          .select('id, time_slot:time_slots!inner(date)', { count: 'exact', head: true })
          .neq('status', 'cancelled')
          .eq('time_slot.date', today)),

        // Alle Buchungen mit Uhrzeiten (für Verteilung)
        filterApt(supabase
          .from('appointments')
          .select('id, time_slot:time_slots!inner(start_time)')
          .neq('status', 'cancelled')),

        // Aktive Behandler (bei Arzt-Filter nur sich selbst)
        practitionerFilter
          ? supabase
              .from('practitioners')
              .select('id, title, first_name, last_name')
              .eq('id', practitionerFilter)
          : supabase
              .from('practitioners')
              .select('id, title, first_name, last_name')
              .eq('is_active', true),
      ]);

      // Stündliche Verteilung berechnen
      const hourCounts = new Map<number, number>();
      if (allBookingsRes.data) {
        for (const appt of allBookingsRes.data) {
          const ts = Array.isArray(appt.time_slot) ? appt.time_slot[0] : appt.time_slot;
          if (ts?.start_time) {
            const hour = parseInt(ts.start_time.slice(0, 2), 10);
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
          }
        }
      }
      const hourlyDistribution = Array.from(hourCounts.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      // Behandler-Auslastung berechnen (schedule-basiert: theoretische Slots aus Schedules)
      const practitionerUtilization: { name: string; percentage: number }[] = [];

      // Helper: berechnet theoretische Slot-Anzahl für eine Liste von Schedules in dieser Woche.
      // Wichtig: Überlappende Schedule-Einträge pro Tag werden gemerged, damit Doppelzählung
      // vermieden wird (z.B. Fr 07:30-12:30 + Fr 07:45-16:00 → effektiv 07:30-16:00).
      const calcTheoreticalSlots = (schedules: Array<{
        day_of_week: number;
        start_time: string;
        end_time: string;
        valid_from?: string | null;
        valid_until?: string | null;
      }>): number => {
        let total = 0;
        const monday = new Date(thisMondayStr);
        for (let i = 0; i < 7; i++) {
          const day = new Date(monday);
          day.setDate(monday.getDate() + i);
          const dayStr = day.toISOString().split('T')[0];
          const isoDow = ((day.getDay() + 6) % 7) + 1; // 1=Mo..7=So

          // Sammle Intervalle [startMin, endMin] des Tages.
          // Wichtig: Online-Buchung erst ab 09:00 → Schedule-Start bei 09:00 cappen.
          const intervals: Array<[number, number]> = [];
          for (const s of schedules) {
            if (s.day_of_week !== isoDow) continue;
            if (s.valid_from && dayStr < s.valid_from) continue;
            if (s.valid_until && dayStr > s.valid_until) continue;
            const [sh, sm] = s.start_time.split(':').map(Number);
            const [eh, em] = s.end_time.split(':').map(Number);
            const startMin = Math.max(sh * 60 + sm, 9 * 60); // ab 09:00
            const endMin = eh * 60 + em;
            if (endMin > startMin) intervals.push([startMin, endMin]);
          }
          if (intervals.length === 0) continue;

          // Merge überlappende / aneinander-grenzende Intervalle
          intervals.sort((a, b) => a[0] - b[0]);
          const merged: Array<[number, number]> = [intervals[0]];
          for (let k = 1; k < intervals.length; k++) {
            const prev = merged[merged.length - 1];
            const cur = intervals[k];
            if (cur[0] <= prev[1]) {
              prev[1] = Math.max(prev[1], cur[1]);
            } else {
              merged.push(cur);
            }
          }

          for (const [s, e] of merged) total += (e - s) / 10;
        }
        return total;
      };

      // Prüft ob eine Buchung (Datum + Zeit) in einem online-buchbaren Schedule-Fenster
      // des Arztes liegt. Berücksichtigt 09:00-Cap.
      const isInOnlineWindow = (
        dateStr: string,
        timeStr: string,
        schedules: Array<{ day_of_week: number; start_time: string; end_time: string; valid_from?: string | null; valid_until?: string | null }>
      ): boolean => {
        const day = new Date(dateStr);
        const isoDow = ((day.getDay() + 6) % 7) + 1;
        for (const s of schedules) {
          if (s.day_of_week !== isoDow) continue;
          if (s.valid_from && dateStr < s.valid_from) continue;
          if (s.valid_until && dateStr > s.valid_until) continue;
          const cappedStart = s.start_time >= '09:00:00' ? s.start_time : '09:00:00';
          if (timeStr >= cappedStart && timeStr < s.end_time) return true;
        }
        return false;
      };

      if (practitionerFilter && practitionersRes.data?.[0]) {
        // Einzelner Arzt
        const [schedulesRes, bookingsRes] = await Promise.all([
          supabase
            .from('practitioner_schedules')
            .select('day_of_week, start_time, end_time, valid_from, valid_until')
            .eq('practitioner_id', practitionerFilter)
            .eq('is_bookable', true),
          supabase
            .from('appointments')
            .select('time_slot:time_slots!inner(date, start_time)')
            .eq('practitioner_id', practitionerFilter)
            .neq('status', 'cancelled')
            .gte('time_slot.date', thisMondayStr)
            .lte('time_slot.date', thisSundayStr),
        ]);

        const schedules = schedulesRes.data || [];
        const theoreticalSlots = calcTheoreticalSlots(schedules);

        let onlineBookings = 0;
        for (const a of bookingsRes.data || []) {
          const ts = Array.isArray(a.time_slot) ? a.time_slot[0] : a.time_slot;
          if (ts && isInOnlineWindow(ts.date, ts.start_time, schedules)) onlineBookings++;
        }

        const percentage = theoreticalSlots > 0
          ? Math.min(100, Math.round((onlineBookings / theoreticalSlots) * 100))
          : 0;
        const p = practitionersRes.data[0];
        const name = `${p.title ? p.title + ' ' : ''}${p.first_name} ${p.last_name}`;
        practitionerUtilization.push({ name, percentage });
      } else if (practitionersRes.data) {
        // Globale Sicht: für jeden aktiven Behandler eigene Auslastung
        const practIds = practitionersRes.data.map(p => p.id);
        const [allSchedulesRes, allBookingsRes] = await Promise.all([
          supabase
            .from('practitioner_schedules')
            .select('practitioner_id, day_of_week, start_time, end_time, valid_from, valid_until')
            .in('practitioner_id', practIds)
            .eq('is_bookable', true),
          supabase
            .from('appointments')
            .select('practitioner_id, time_slot:time_slots!inner(date, start_time)')
            .neq('status', 'cancelled')
            .gte('time_slot.date', thisMondayStr)
            .lte('time_slot.date', thisSundayStr)
            .in('practitioner_id', practIds),
        ]);

        const schedulesByPract = new Map<string, Array<{
          day_of_week: number;
          start_time: string;
          end_time: string;
          valid_from?: string | null;
          valid_until?: string | null;
        }>>();
        for (const s of allSchedulesRes.data || []) {
          const pid = (s as { practitioner_id: string }).practitioner_id;
          const list = schedulesByPract.get(pid) || [];
          list.push(s);
          schedulesByPract.set(pid, list);
        }

        // Pro Arzt: nur Bookings zählen die in einem online-buchbaren Schedule-Fenster liegen
        const onlineBookingsByPract = new Map<string, number>();
        for (const a of allBookingsRes.data || []) {
          const pid = (a as { practitioner_id: string | null }).practitioner_id;
          if (!pid) continue;
          const ts = Array.isArray(a.time_slot) ? a.time_slot[0] : a.time_slot;
          if (!ts) continue;
          const sched = schedulesByPract.get(pid) || [];
          if (isInOnlineWindow(ts.date, ts.start_time, sched)) {
            onlineBookingsByPract.set(pid, (onlineBookingsByPract.get(pid) || 0) + 1);
          }
        }

        for (const pract of practitionersRes.data) {
          const theoretical = calcTheoreticalSlots(schedulesByPract.get(pract.id) || []);
          const bookings = onlineBookingsByPract.get(pract.id) || 0;
          const percentage = theoretical > 0
            ? Math.min(100, Math.round((bookings / theoretical) * 100))
            : 0;
          const name = `${pract.title ? pract.title + ' ' : ''}${pract.first_name} ${pract.last_name}`;
          practitionerUtilization.push({ name, percentage });
        }
        practitionerUtilization.sort((a, b) => b.percentage - a.percentage);
      }

      setData({
        bookingsThisWeek: thisWeekRes.count || 0,
        bookingsLastWeek: lastWeekRes.count || 0,
        bookingsToday: todayRes.count || 0,
        hourlyDistribution,
        practitionerUtilization,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Analytics');
    } finally {
      setLoading(false);
    }
  }, [practitionerFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
}

// =====================================================
// MFA Hooks
// =====================================================

// Hook: MFA Appointments für Kalenderansicht (normalisiert auf AppointmentWithDetails)
export function useMfaAppointments(date: Date, view: CalendarView) {
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

      // Step 1: Get ALL raw mfa_appointments (no joins)
      const { data: rawAppts, error: apptsError } = await supabase
        .from('mfa_appointments')
        .select('*');

      if (apptsError) throw apptsError;
      if (!rawAppts || rawAppts.length === 0) {
        setAppointments([]);
        return;
      }

      // Step 2: Get related data separately (small, unique ID sets)
      const patientIds = [...new Set(rawAppts.map(a => a.patient_id))];
      const slotIds = [...new Set(rawAppts.map(a => a.mfa_time_slot_id))];
      const treatmentIds = [...new Set(rawAppts.map(a => a.mfa_treatment_type_id))];

      const [patientsRes, slotsRes, treatmentsRes] = await Promise.all([
        supabase.from('patients').select('id, name, email, phone').in('id', patientIds),
        supabase.from('mfa_time_slots').select('id, date, start_time, end_time').in('id', slotIds),
        supabase.from('mfa_treatment_types').select('id, name, duration_minutes').in('id', treatmentIds),
      ]);

      const patientMap = new Map((patientsRes.data || []).map(p => [p.id, p]));
      const slotMap = new Map((slotsRes.data || []).map(s => [s.id, s]));
      const treatmentMap = new Map((treatmentsRes.data || []).map(t => [t.id, t]));

      // Step 3: Merge, filter by date range, normalize
      const normalized: AppointmentWithDetails[] = rawAppts
        .map((mfa: any) => {
          const slot = slotMap.get(mfa.mfa_time_slot_id);
          const patient = patientMap.get(mfa.patient_id);
          const treatment = treatmentMap.get(mfa.mfa_treatment_type_id);
          return {
            ...mfa,
            patient: patient || null,
            treatment_type: treatment || null,
            time_slot: slot || { id: mfa.mfa_time_slot_id, date: '', start_time: '', end_time: '' },
            practitioner: null,
            time_slot_id: mfa.mfa_time_slot_id,
            treatment_type_id: mfa.mfa_treatment_type_id,
            practitioner_id: null,
            bookingType: 'mfa' as const,
          };
        })
        .filter((apt: any) => {
          const slotDate = apt.time_slot?.date;
          return slotDate && slotDate >= startDate && slotDate <= endDate;
        });

      // Sort by date+time
      normalized.sort((a, b) => {
        const dateA = a.time_slot?.date || '';
        const dateB = b.time_slot?.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.time_slot?.start_time || '').localeCompare(b.time_slot?.start_time || '');
      });

      setAppointments(normalized);
    } catch (err) {
      console.error('[MFA Debug] ERROR:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der MFA-Termine');
    } finally {
      setLoading(false);
    }
  }, [date, view]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return { appointments, loading, error, refetch: fetchAppointments };
}

// Hook: MFA-Termin-Status ändern
export function useUpdateMfaAppointmentStatus() {
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
        .from('mfa_appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      // Absage-Benachrichtigung senden (ORTHO-040)
      if (status === 'cancelled') {
        supabase.functions.invoke('send-cancellation-notification', {
          body: { appointmentId, booking_type: 'mfa' },
        }).then(({ error }) => {
          if (error) console.error('Fehler beim Senden der MFA-Absage-Benachrichtigung:', error);
        });
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

// Hook: MFA-Leistungen CRUD (Admin)
export function useMfaTreatmentTypesAdmin() {
  const [treatmentTypes, setTreatmentTypes] = useState<MfaTreatmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('mfa_treatment_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setTreatmentTypes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const createType = useCallback(async (
    data: { name: string; name_en?: string; name_tr?: string; duration_minutes: number; specialty_id?: string | null }
  ) => {
    const maxOrder = treatmentTypes.reduce((max, t) => Math.max(max, t.sort_order), 0);
    const { error } = await supabase
      .from('mfa_treatment_types')
      .insert([{ ...data, is_active: true, sort_order: maxOrder + 1 }]);

    if (error) return { success: false, error: error.message };
    await fetchTypes();
    return { success: true };
  }, [fetchTypes, treatmentTypes]);

  const updateType = useCallback(async (
    id: string,
    data: Partial<MfaTreatmentType>
  ) => {
    const { error } = await supabase
      .from('mfa_treatment_types')
      .update(data)
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    await fetchTypes();
    return { success: true };
  }, [fetchTypes]);

  return {
    treatmentTypes,
    loading,
    error,
    createType,
    updateType,
    refetch: fetchTypes,
  };
}

// Hook: Admin MFA-Buchung erstellen
export function useAdminCreateMfaBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useCallback(async (data: {
    mfaTimeSlotId: string;
    mfaTreatmentTypeId: string;
    insuranceTypeId: string;
    patientName: string;
    patientEmail?: string;
    patientPhone?: string;
    notes?: string;
    existingPatientId?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Check capacity
      const { data: available } = await supabase
        .rpc('check_mfa_slot_availability', { p_slot_id: data.mfaTimeSlotId });

      if (!available) {
        throw new Error('Dieser MFA-Zeitslot ist bereits voll belegt.');
      }

      // 2. Use existing patient or create new
      let patient: { id: string };
      if (data.existingPatientId) {
        patient = { id: data.existingPatientId };
        if (data.patientPhone || data.patientEmail) {
          await supabase
            .from('patients')
            .update({
              ...(data.patientPhone ? { phone: data.patientPhone } : {}),
              ...(data.patientEmail ? { email: data.patientEmail } : {}),
            })
            .eq('id', data.existingPatientId);
        }
      } else {
        const { data: newPatient, error: patientError } = await supabase
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
        patient = newPatient;
      }

      // 3. Create MFA appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('mfa_appointments')
        .insert({
          patient_id: patient.id,
          mfa_treatment_type_id: data.mfaTreatmentTypeId,
          mfa_time_slot_id: data.mfaTimeSlotId,
          notes: data.notes || null,
          status: 'confirmed',
          booked_by: 'admin',
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // 4. Send confirmation email/SMS if contact info provided (ORTHO-040)
      if (data.patientEmail || data.patientPhone) {
        supabase.functions.invoke('send-booking-confirmation', {
          body: { appointmentId: appointment.id, booking_type: 'mfa' },
        }).then(({ error }) => {
          if (error) console.error('Fehler beim Senden der MFA-Bestätigung:', error);
        });
      }

      return { success: true, appointmentId: appointment.id, patientId: patient.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der MFA-Buchung';
      setError(message);
      return { success: false as const, error: message, appointmentId: undefined, patientId: undefined };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { createBooking, loading, error, clearError };
}

// Hook: Verfügbare MFA-Slots für Admin (per Datum)
export function useAdminMfaAvailableSlots(date: string | null) {
  const [slots, setSlots] = useState<{ id: string; start_time: string; end_time: string; available: boolean }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }

    async function fetch() {
      setLoading(true);
      try {
        // Get all MFA slots for the date
        const { data: mfaSlots, error: slotsError } = await supabase
          .from('mfa_time_slots')
          .select('id, start_time, end_time, max_parallel')
          .eq('date', date)
          .order('start_time', { ascending: true });

        if (slotsError) throw slotsError;

        // Get booking counts for those slots
        const slotIds = (mfaSlots || []).map(s => s.id);
        const { data: counts } = await supabase
          .from('mfa_appointments')
          .select('mfa_time_slot_id')
          .in('mfa_time_slot_id', slotIds)
          .neq('status', 'cancelled');

        const countMap = new Map<string, number>();
        (counts || []).forEach(c => {
          countMap.set(c.mfa_time_slot_id, (countMap.get(c.mfa_time_slot_id) || 0) + 1);
        });

        const result = (mfaSlots || []).map(s => ({
          id: s.id,
          start_time: s.start_time,
          end_time: s.end_time,
          available: (countMap.get(s.id) || 0) < s.max_parallel,
        }));

        setSlots(result);
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [date]);

  return { slots, loading };
}

// Hook: MFA-Slots generieren
export function useGenerateMfaSlots() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ slots_created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSlots = useCallback(async (weeksAhead: number = 4) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: rpcError } = await supabase
        .rpc('generate_mfa_time_slots', { weeks_ahead: weeksAhead });

      if (rpcError) throw rpcError;

      const resultData = data?.[0] || { slots_created: 0 };
      setResult(resultData);
      return { success: true, data: resultData };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der MFA-Slot-Generierung';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateSlots, loading, result, error };
}

// =====================================================
// Hook: Terminverlegung (ORTHO-031)
// =====================================================

export function useRescheduleAppointment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reschedule = useCallback(async (data: {
    appointmentId: string;
    bookingType: 'doctor' | 'mfa';
    newSlotId: string;
    additionalSlotIds?: string[];
    oldDate: string;
    oldTime: string;
    patientEmail?: string | null;
    patientPhone?: string | null;
  }) => {
    setLoading(true);
    setError(null);

    try {
      if (data.bookingType === 'mfa') {
        const { data: result, error: rpcError } = await supabase
          .rpc('reschedule_mfa_appointment', {
            p_appointment_id: data.appointmentId,
            p_new_mfa_slot_id: data.newSlotId,
          });

        if (rpcError) throw rpcError;
        if (!result?.success) throw new Error('Verlegung fehlgeschlagen');
      } else {
        const { data: result, error: rpcError } = await supabase
          .rpc('reschedule_appointment', {
            p_appointment_id: data.appointmentId,
            p_new_time_slot_id: data.newSlotId,
            p_additional_slot_ids: data.additionalSlotIds || [],
          });

        if (rpcError) throw rpcError;
        if (!result?.success) throw new Error('Verlegung fehlgeschlagen');
      }

      // E-Mail/SMS senden (non-blocking, ORTHO-040)
      if (data.patientEmail || data.patientPhone) {
        supabase.functions.invoke('send-reschedule-notification', {
          body: {
            appointmentId: data.appointmentId,
            bookingType: data.bookingType,
            oldDate: data.oldDate,
            oldTime: data.oldTime,
          },
        }).then(({ error }) => {
          if (error) console.error('Fehler beim Senden der Verlegungsmail:', error);
        });
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Verlegung';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { reschedule, loading, error, clearError };
}

// =====================================================
// Hook: Individuelle Sprechzeiten (ORTHO-028)
// =====================================================

export interface PractitionerScheduleEntry {
  id: string;
  practitioner_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_bookable: boolean;
  insurance_filter: 'all' | 'private_only';
  label: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

export function usePractitionerSchedulesAdmin() {
  const [schedules, setSchedules] = useState<PractitionerScheduleEntry[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('practitioner_schedules')
        .select('*')
        .order('practitioner_id')
        .order('day_of_week')
        .order('start_time');

      if (fetchError) throw fetchError;
      setSchedules(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Sprechzeiten');
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
    if (!error && data) setPractitioners(data);
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchPractitioners();
  }, [fetchSchedules, fetchPractitioners]);

  const createSchedule = useCallback(async (data: {
    practitioner_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_bookable: boolean;
    insurance_filter: 'all' | 'private_only';
    label?: string;
    valid_from: string;
    valid_until?: string | null;
  }) => {
    const { error } = await supabase
      .from('practitioner_schedules')
      .insert(data);
    if (error) return { success: false, error: error.message };
    await fetchSchedules();
    return { success: true };
  }, [fetchSchedules]);

  const deleteSchedule = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('practitioner_schedules')
      .delete()
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    await fetchSchedules();
    return { success: true };
  }, [fetchSchedules]);

  return {
    schedules,
    practitioners,
    loading,
    error,
    createSchedule,
    deleteSchedule,
    refetch: fetchSchedules,
  };
}
