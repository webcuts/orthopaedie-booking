import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type {
  InsuranceType,
  TreatmentType,
  TimeSlot,
  PatientInput,
  Patient,
  Appointment,
  Specialty,
  Practitioner,
  PracticeHours
} from '../types/database';

// =====================================================
// Basis-Hooks
// =====================================================

export function useSupabaseConnection() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase
          .from('insurance_types')
          .select('id')
          .limit(1);

        if (error) throw error;
        setConnected(true);
      } catch (err) {
        setConnected(false);
        setError(err instanceof Error ? err.message : 'Verbindungsfehler');
      }
    }
    testConnection();
  }, []);

  return { connected, error };
}

// =====================================================
// Hook: Fachgebiete (Step 1)
// =====================================================

export function useSpecialties() {
  const [data, setData] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setData(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Fachgebiete');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// =====================================================
// Hook: Versicherungsarten (Step 2)
// =====================================================

export function useInsuranceTypes() {
  const [data, setData] = useState<InsuranceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('insurance_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setData(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Versicherungsarten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// =====================================================
// Hook: Terminarten (Step 3)
// =====================================================

export function useTreatmentTypes() {
  const [data, setData] = useState<TreatmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('treatment_types')
        .select('*')
        .eq('is_active', true)
        .order('duration_minutes');

      if (error) throw error;
      setData(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Terminarten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// =====================================================
// Hook: Behandler gefiltert nach Fachgebiet (Step 4)
// Filtert automatisch abwesende Behandler aus
// =====================================================

export function usePractitioners(specialtyId: string | null) {
  const [data, setData] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!specialtyId) {
      setData([]);
      return;
    }

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Lade alle aktiven Behandler des Fachgebiets
        const { data: practitioners, error: practError } = await supabase
          .from('practitioners')
          .select('*')
          .eq('specialty_id', specialtyId)
          .eq('is_active', true)
          .or(`available_from.is.null,available_from.lte.${today}`)
          .order('last_name');

        if (practError) throw practError;

        // 2. Lade aktive Abwesenheiten
        const { data: absences, error: absError } = await supabase
          .from('practitioner_absences')
          .select('practitioner_id')
          .lte('start_date', today)
          .gte('end_date', today);

        // Ignoriere Fehler bei Abwesenheiten (Tabelle existiert evtl. noch nicht)
        const absentIds = new Set((absences || []).map(a => a.practitioner_id));

        // 3. Filtere abwesende Behandler aus
        const availablePractitioners = (practitioners || []).filter(
          p => !absentIds.has(p.id)
        );

        setData(availablePractitioners);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Behandler');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [specialtyId]);

  return { data, loading, error };
}

// =====================================================
// Hook: Öffnungszeiten
// =====================================================

export function usePracticeHours() {
  const [data, setData] = useState<PracticeHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('practice_hours')
          .select('*')
          .order('day_of_week');

        if (error) throw error;
        setData(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Öffnungszeiten');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { data, loading, error };
}

// =====================================================
// Hook: Verfügbare Tage mit Slots (Step 5)
// =====================================================

export function useAvailableDates(month: Date) {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
        const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = startOfMonth < today ? today.toISOString().split('T')[0] : startOfMonth.toISOString().split('T')[0];
        const endDate = endOfMonth.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('time_slots')
          .select('date')
          .eq('is_available', true)
          .gte('date', startDate)
          .lte('date', endDate);

        if (error) throw error;

        const uniqueDates = [...new Set((data || []).map(slot => slot.date))];
        setData(uniqueDates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der verfügbaren Tage');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [month]);

  return { data, loading, error };
}

// =====================================================
// Hook: Zeitslots für einen Tag (Step 6)
// =====================================================

export function useTimeSlots(date: string | null) {
  const [data, setData] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setData([]);
      return;
    }

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('time_slots')
          .select('*')
          .eq('date', date)
          .eq('is_available', true)
          .order('start_time');

        if (error) throw error;
        setData(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Zeitslots');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [date]);

  return { data, loading, error };
}

// =====================================================
// Hook: Buchung erstellen (Step 7)
// =====================================================

interface BookingData {
  patientData: PatientInput;
  treatmentTypeId: string;
  timeSlotId: string;
  practitionerId: string | null;
  notes?: string;
}

interface BookingResult {
  patient: Patient;
  appointment: Appointment;
}

export function useCreateBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useCallback(async (bookingData: BookingData): Promise<BookingResult | null> => {
    setLoading(true);
    setError(null);

    try {
      // 1. Check if slot is still available
      const { data: slotCheck, error: slotCheckError } = await supabase
        .from('time_slots')
        .select('is_available')
        .eq('id', bookingData.timeSlotId)
        .single();

      if (slotCheckError) throw slotCheckError;
      if (!slotCheck?.is_available) {
        throw new Error('Dieser Zeitslot wurde leider gerade vergeben. Bitte wählen Sie einen anderen.');
      }

      // 2. Create patient
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert(bookingData.patientData)
        .select()
        .single();

      if (patientError) throw patientError;

      // 3. Create appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patient.id,
          treatment_type_id: bookingData.treatmentTypeId,
          time_slot_id: bookingData.timeSlotId,
          practitioner_id: bookingData.practitionerId,
          notes: bookingData.notes || null,
          status: 'confirmed'
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // 4. Mark time slot as unavailable
      const { error: slotUpdateError } = await supabase
        .from('time_slots')
        .update({ is_available: false })
        .eq('id', bookingData.timeSlotId);

      if (slotUpdateError) throw slotUpdateError;

      // 5. Send confirmation emails (non-blocking)
      // Bestätigung an Patient
      supabase.functions.invoke('send-booking-confirmation', {
        body: { appointmentId: appointment.id }
      }).then(({ error }) => {
        if (error) console.error('Fehler beim Senden der Bestätigung:', error);
      });

      // Benachrichtigung an Praxis
      supabase.functions.invoke('send-practice-notification', {
        body: { appointmentId: appointment.id }
      }).then(({ error }) => {
        if (error) console.error('Fehler beim Senden der Praxis-Benachrichtigung:', error);
      });

      return { patient, appointment };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Buchung';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { createBooking, loading, error, clearError };
}
