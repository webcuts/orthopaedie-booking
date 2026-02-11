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
  PracticeHours,
  MfaTreatmentType,
  MfaTimeSlot,
  MfaAppointment
} from '../types/database';

// =====================================================
// Hilfsfunktionen
// =====================================================

/**
 * Formatiert ein Date-Objekt als YYYY-MM-DD String
 * OHNE Timezone-Konvertierung (verwendet lokale Zeit)
 * Verhindert Off-by-One Fehler bei Datumsauswahl
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
        const today = formatLocalDate(new Date());

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
        const { data: absences } = await supabase
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
// Nutzt RPC get_available_dates für Behandler-Filterung
// =====================================================

export function useAvailableDates(month: Date, practitionerId: string | null = null) {
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

        const startDate = startOfMonth < today ? formatLocalDate(today) : formatLocalDate(startOfMonth);
        const endDate = formatLocalDate(endOfMonth);

        const { data, error } = await supabase
          .rpc('get_available_dates', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_practitioner_id: practitionerId
          });

        if (error) throw error;

        setData((data || []).map((row: { date: string }) => row.date));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der verfügbaren Tage');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [month, practitionerId]);

  return { data, loading, error };
}

// =====================================================
// Hook: Zeitslots für einen Tag (Step 6)
// Nutzt RPC get_available_slots für Behandler-Filterung
// =====================================================

export function useTimeSlots(date: string | null, practitionerId: string | null = null) {
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
          .rpc('get_available_slots', {
            p_date: date,
            p_practitioner_id: practitionerId
          });

        if (error) throw error;
        setData(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Zeitslots');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [date, practitionerId]);

  return { data, loading, error };
}

// =====================================================
// Hook: Nächster freier Termin (ORTHO-023)
// =====================================================

export function useNextFreeSlot() {
  const [date, setDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const now = new Date();
        const today = formatLocalDate(now);
        const maxDate = new Date(now);
        maxDate.setDate(maxDate.getDate() + 28);
        const maxDateStr = formatLocalDate(maxDate);

        // Cutoff für heute: jetzt + 30 min
        const cutoff = new Date(now.getTime() + 30 * 60 * 1000);
        const cutoffTime = cutoff.toTimeString().slice(0, 5);

        // Verfügbare Slots ab heute, sortiert nach Datum + Uhrzeit
        const { data: slots, error } = await supabase
          .from('time_slots')
          .select('date, start_time')
          .eq('is_available', true)
          .gte('date', today)
          .lte('date', maxDateStr)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(50);

        if (error || !slots?.length) {
          setDate(null);
          setStartTime(null);
          return;
        }

        // Finde den ersten Slot, der nicht in der Vergangenheit liegt
        for (const slot of slots) {
          if (slot.date === today && slot.start_time.slice(0, 5) <= cutoffTime) {
            continue;
          }
          setDate(slot.date);
          setStartTime(slot.start_time);
          return;
        }

        setDate(null);
        setStartTime(null);
      } catch {
        setDate(null);
        setStartTime(null);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { date, startTime, loading };
}

// =====================================================
// MFA Hooks (ORTHO-027)
// =====================================================

export function useMfaTreatmentTypes() {
  const [data, setData] = useState<MfaTreatmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('mfa_treatment_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setData(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der MFA-Leistungen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useMfaAvailableDates(month: Date) {
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

        const startDate = startOfMonth < today ? formatLocalDate(today) : formatLocalDate(startOfMonth);
        const endDate = formatLocalDate(endOfMonth);

        // Lade MFA-Slots mit Buchungszählung
        const { data: slots, error } = await supabase
          .from('mfa_time_slots')
          .select('id, date, max_parallel')
          .gte('date', startDate)
          .lte('date', endDate);

        if (error) throw error;
        if (!slots?.length) { setData([]); return; }

        // Lade Buchungen für diese Slots
        const slotIds = slots.map(s => s.id);
        const { data: bookings } = await supabase
          .from('mfa_appointments')
          .select('mfa_time_slot_id')
          .in('mfa_time_slot_id', slotIds)
          .neq('status', 'cancelled');

        const bookingCounts = new Map<string, number>();
        (bookings || []).forEach(b => {
          bookingCounts.set(b.mfa_time_slot_id, (bookingCounts.get(b.mfa_time_slot_id) || 0) + 1);
        });

        // Tage mit mindestens einem verfügbaren Slot
        const availableDates = new Set<string>();
        slots.forEach(slot => {
          const count = bookingCounts.get(slot.id) || 0;
          if (count < slot.max_parallel) {
            availableDates.add(slot.date);
          }
        });

        setData(Array.from(availableDates).sort());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der verfügbaren MFA-Tage');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [month]);

  return { data, loading, error };
}

export function useMfaTimeSlots(date: string | null) {
  const [data, setData] = useState<(MfaTimeSlot & { available: boolean })[]>([]);
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
        const { data: slots, error } = await supabase
          .from('mfa_time_slots')
          .select('*')
          .eq('date', date)
          .order('start_time');

        if (error) throw error;
        if (!slots?.length) { setData([]); return; }

        // Lade Buchungen für diese Slots
        const slotIds = slots.map(s => s.id);
        const { data: bookings } = await supabase
          .from('mfa_appointments')
          .select('mfa_time_slot_id')
          .in('mfa_time_slot_id', slotIds)
          .neq('status', 'cancelled');

        const bookingCounts = new Map<string, number>();
        (bookings || []).forEach(b => {
          bookingCounts.set(b.mfa_time_slot_id, (bookingCounts.get(b.mfa_time_slot_id) || 0) + 1);
        });

        const slotsWithAvailability = slots.map(slot => ({
          ...slot,
          available: (bookingCounts.get(slot.id) || 0) < slot.max_parallel
        }));

        setData(slotsWithAvailability);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der MFA-Zeitslots');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [date]);

  return { data, loading, error };
}

// =====================================================
// Hook: MFA-Buchung erstellen
// =====================================================

interface MfaBookingData {
  patientData: PatientInput;
  mfaTreatmentTypeId: string;
  mfaTimeSlotId: string;
  notes?: string;
  language?: string;
  consent_given?: boolean;
  consent_timestamp?: string;
}

interface MfaBookingResult {
  patient: Patient;
  appointment: MfaAppointment;
}

export function useCreateMfaBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useCallback(async (bookingData: MfaBookingData): Promise<MfaBookingResult | null> => {
    setLoading(true);
    setError(null);

    try {
      // 0. Rate Limit prüfen (zählt Doctor + MFA zusammen)
      const { data: allowed, error: rateLimitError } = await supabase
        .rpc('check_booking_rate_limit', { p_email: bookingData.patientData.email });

      if (rateLimitError) {
        console.error('Rate limit check failed:', rateLimitError);
      } else if (allowed === false) {
        throw new Error('Sie haben bereits mehrere Termine gebucht. Bitte kontaktieren Sie die Praxis telefonisch.');
      }

      // 1. Kapazitätsprüfung
      const { data: available, error: capError } = await supabase
        .rpc('check_mfa_slot_availability', { p_slot_id: bookingData.mfaTimeSlotId });

      if (capError) {
        console.error('Capacity check failed:', capError);
      } else if (available === false) {
        throw new Error('Dieser Zeitslot ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen.');
      }

      // 2. Patient anlegen
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert(bookingData.patientData)
        .select()
        .single();

      if (patientError) throw patientError;

      // 3. MFA-Appointment anlegen
      const { data: appointment, error: appointmentError } = await supabase
        .from('mfa_appointments')
        .insert({
          patient_id: patient.id,
          mfa_treatment_type_id: bookingData.mfaTreatmentTypeId,
          mfa_time_slot_id: bookingData.mfaTimeSlotId,
          notes: bookingData.notes || null,
          language: bookingData.language || 'de',
          consent_given: bookingData.consent_given || false,
          consent_timestamp: bookingData.consent_timestamp || null,
          booked_by: 'patient',
          status: 'confirmed'
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // 4. Bestätigungs-E-Mails (non-blocking)
      supabase.functions.invoke('send-booking-confirmation', {
        body: { appointmentId: appointment.id, booking_type: 'mfa' }
      }).then(({ error }) => {
        if (error) console.error('Fehler beim Senden der MFA-Bestätigung:', error);
      });

      supabase.functions.invoke('send-practice-notification', {
        body: { appointmentId: appointment.id, booking_type: 'mfa' }
      }).then(({ error }) => {
        if (error) console.error('Fehler beim Senden der MFA-Praxis-Benachrichtigung:', error);
      });

      return { patient, appointment };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der MFA-Buchung';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { createBooking, loading, error, clearError };
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
  language?: string;
  consent_given?: boolean;
  consent_timestamp?: string;
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
      // 0. Rate Limit prüfen (max 3 Buchungen pro E-Mail in 24h)
      const { data: allowed, error: rateLimitError } = await supabase
        .rpc('check_booking_rate_limit', { p_email: bookingData.patientData.email });

      if (rateLimitError) {
        console.error('Rate limit check failed:', rateLimitError);
      } else if (allowed === false) {
        throw new Error('Sie haben bereits mehrere Termine gebucht. Bitte kontaktieren Sie die Praxis telefonisch.');
      }

      // 1. Create patient
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert(bookingData.patientData)
        .select()
        .single();

      if (patientError) throw patientError;

      // 2. Create appointment
      // Verfügbarkeit wird durch UNIQUE Index (time_slot_id, practitioner_id)
      // auf DB-Ebene sichergestellt — Doppelbuchungen sind unmöglich
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patient.id,
          treatment_type_id: bookingData.treatmentTypeId,
          time_slot_id: bookingData.timeSlotId,
          practitioner_id: bookingData.practitionerId,
          notes: bookingData.notes || null,
          language: bookingData.language || 'de',
          consent_given: bookingData.consent_given || false,
          consent_timestamp: bookingData.consent_timestamp || null,
          status: 'confirmed'
        })
        .select()
        .single();

      if (appointmentError) {
        // UNIQUE constraint violation = Slot bereits vergeben
        if (appointmentError.code === '23505') {
          throw new Error('Dieser Zeitslot wurde leider gerade vergeben. Bitte wählen Sie einen anderen.');
        }
        throw appointmentError;
      }

      // 3. Send confirmation emails (non-blocking)
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
