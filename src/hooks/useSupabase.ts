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
  MfaAppointment,
  PractitionerSchedule
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

/**
 * Findet bestehenden Patienten via Name+Telefon oder legt neuen an.
 *
 * Defensive Dedup-Regeln:
 * - Match nur bei exakt gleichem Name + Telefon
 * - E-Mail wird nur nachgetragen, falls sie vorher leer war
 * - Bei E-Mail-KONFLIKT (alt gesetzt, neu abweichend) wird ein NEUER Patient
 *   angelegt — könnten zwei verschiedene Personen sein. Die MFA kann den
 *   Konflikt später in der Patientensuche sehen und manuell zusammenführen.
 */
async function findOrCreatePatient(patientData: PatientInput): Promise<Patient> {
  const name = patientData.name.trim();
  const phone = patientData.phone?.trim() || null;
  const email = patientData.email?.trim() || null;

  if (phone) {
    const { data: existing } = await supabase
      .from('patients')
      .select('*')
      .eq('name', name)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      const oldEmail = existing.email?.trim() || null;
      const conflict = !!oldEmail && !!email && oldEmail.toLowerCase() !== email.toLowerCase();

      if (conflict) {
        // Sicherheitshalber neuen Patienten anlegen statt fremde Daten zu überschreiben
        const { data: newPatient, error } = await supabase
          .from('patients')
          .insert(patientData)
          .select()
          .single();
        if (error || !newPatient) throw error || new Error('Patient konnte nicht angelegt werden');
        return newPatient;
      }

      // E-Mail nur nachtragen falls vorher leer
      if (!oldEmail && email) {
        const { data: updated } = await supabase
          .from('patients')
          .update({ email })
          .eq('id', existing.id)
          .select()
          .single();
        return updated || existing;
      }
      return existing;
    }
  }

  const { data: newPatient, error } = await supabase
    .from('patients')
    .insert(patientData)
    .select()
    .single();
  if (error || !newPatient) throw error || new Error('Patient konnte nicht angelegt werden');
  return newPatient;
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
        .eq('patient_visible', true)
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
// Hook: Alle Behandler ohne Fachgebiet-Filter (ORTHO-042)
// =====================================================

export interface PractitionerAbsenceInfo {
  practitioner_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  public_message: string | null;
}

export function useAllPractitioners() {
  const [data, setData] = useState<Practitioner[]>([]);
  const [absentMap, setAbsentMap] = useState<Map<string, PractitionerAbsenceInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const today = formatLocalDate(new Date());

        const { data: practitioners, error: practError } = await supabase
          .from('practitioners')
          .select('*')
          .eq('is_active', true)
          .or(`available_from.is.null,available_from.lte.${today}`)
          .order('last_name');

        if (practError) throw practError;

        // Abwesende Behandler laden (nicht filtern, sondern markieren)
        const { data: absences } = await supabase
          .from('practitioner_absences')
          .select('practitioner_id, start_date, end_date, reason, public_message')
          .lte('start_date', today)
          .gte('end_date', today);

        const absMap = new Map<string, PractitionerAbsenceInfo>();
        (absences || []).forEach(a => absMap.set(a.practitioner_id, a));
        setAbsentMap(absMap);

        // Sortierung: Verfügbare vor Abwesenden
        const available = (practitioners || []).filter(p => !absMap.has(p.id));
        const absent = (practitioners || []).filter(p => absMap.has(p.id));
        setData([...available, ...absent]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Behandler');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { data, absentMap, loading, error };
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
// Hook: Individuelle Sprechzeiten pro Behandler (ORTHO-028)
// =====================================================

export function usePractitionerSchedules(practitionerId: string | null) {
  const [data, setData] = useState<PractitionerSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!practitionerId) {
      setData([]);
      return;
    }

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const today = formatLocalDate(new Date());
        const { data, error } = await supabase
          .from('practitioner_schedules')
          .select('*')
          .eq('practitioner_id', practitionerId)
          .lte('valid_from', today)
          .or(`valid_until.is.null,valid_until.gte.${today}`)
          .order('day_of_week')
          .order('start_time');

        if (error) throw error;
        setData(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Sprechzeiten');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [practitionerId]);

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

        let dates = (data || []).map((row: { date: string }) => row.date);

        // Schedule-Filter: Wenn Behandler practitioner_schedules hat, nur Daten
        // zeigen, an denen mindestens ein bookable Schedule für den Wochentag gilt.
        // Behandler ohne Schedules (z.B. Mohammed) bleiben uneingeschränkt.
        if (practitionerId) {
          const { data: schedules } = await supabase
            .from('practitioner_schedules')
            .select('day_of_week, is_bookable, valid_from, valid_until')
            .eq('practitioner_id', practitionerId)
            .lte('valid_from', endDate)
            .or(`valid_until.is.null,valid_until.gte.${startDate}`);

          if (schedules && schedules.length > 0) {
            dates = dates.filter((dateStr: string) => {
              const d = new Date(dateStr + 'T00:00:00');
              const dow = d.getDay();
              return schedules.some(s =>
                s.day_of_week === dow
                && s.is_bookable === true
                && s.valid_from <= dateStr
                && (s.valid_until === null || s.valid_until >= dateStr)
              );
            });
          }
        }

        setData(dates);
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

        let slots: TimeSlot[] = data || [];

        // Schedule-Filter: Wenn Behandler practitioner_schedules für diesen Tag hat,
        // nur Slots innerhalb is_bookable=true Fenster behalten.
        if (practitionerId && date) {
          const { data: schedules } = await supabase
            .from('practitioner_schedules')
            .select('day_of_week, start_time, end_time, is_bookable, valid_from, valid_until')
            .eq('practitioner_id', practitionerId)
            .lte('valid_from', date)
            .or(`valid_until.is.null,valid_until.gte.${date}`);

          if (schedules && schedules.length > 0) {
            const d = new Date(date + 'T00:00:00');
            const dow = d.getDay();
            const matching = schedules.filter(s =>
              s.day_of_week === dow
              && s.valid_from <= date
              && (s.valid_until === null || s.valid_until >= date)
            );

            if (matching.length > 0) {
              const bookableWindows = matching
                .filter(s => s.is_bookable === true)
                .map(s => ({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) }));

              slots = slots.filter(slot => {
                const t = slot.start_time.slice(0, 5);
                return bookableWindows.some(w => t >= w.start && t < w.end);
              });
            }
          }
        }

        setData(slots);
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

export function useNextFreeSlot(practitionerId?: string | null, insuranceTypeId?: string | null) {
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

        // Practitioner-Schedule laden (falls vorhanden)
        let schedules: PractitionerSchedule[] = [];
        if (practitionerId) {
          const { data: sData } = await supabase
            .from('practitioner_schedules')
            .select('*')
            .eq('practitioner_id', practitionerId)
            .lte('valid_from', today)
            .or(`valid_until.is.null,valid_until.gte.${today}`);
          schedules = sData || [];
        }

        // Insurance-Typ prüfen für private_only Filter
        let isPublicInsurance = false;
        if (insuranceTypeId && schedules.length > 0) {
          const { data: insData } = await supabase
            .from('insurance_types')
            .select('name')
            .eq('id', insuranceTypeId)
            .single();
          isPublicInsurance = insData?.name?.includes('Gesetzlich') || false;
        }

        // Verfügbare Slots ab heute, sortiert nach Datum + Uhrzeit
        const { data: slots, error } = await supabase
          .from('time_slots')
          .select('id, date, start_time')
          .eq('is_available', true)
          .gte('date', today)
          .lte('date', maxDateStr)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(200);

        if (error || !slots?.length) {
          setDate(null);
          setStartTime(null);
          return;
        }

        // Termine des Behandlers im Zeitraum laden,
        // damit bereits gebuchte Slots dieses Behandlers ausgeschlossen werden.
        // time_slots.is_available ist global, aber ein Slot kann für einen Behandler
        // belegt und für andere frei sein (UNIQUE time_slot_id+practitioner_id auf appointments).
        let bookedSlotIds = new Set<string>();
        if (practitionerId) {
          const slotIds = slots.map(s => s.id);
          const { data: booked } = await supabase
            .from('appointments')
            .select('time_slot_id')
            .eq('practitioner_id', practitionerId)
            .neq('status', 'cancelled')
            .in('time_slot_id', slotIds);
          bookedSlotIds = new Set((booked || []).map(b => b.time_slot_id));
        }

        // Finde den ersten Slot, der nicht in der Vergangenheit liegt,
        // innerhalb der buchbaren Schedule-Fenster liegt
        // und nicht bereits für diesen Behandler gebucht ist
        for (const slot of slots) {
          if (slot.date === today && slot.start_time.slice(0, 5) <= cutoffTime) {
            continue;
          }

          if (bookedSlotIds.has(slot.id)) continue;

          // Practitioner-Schedule Filter
          if (schedules.length > 0) {
            const slotDate = new Date(slot.date + 'T00:00:00');
            const jsDayOfWeek = slotDate.getDay();
            const time = slot.start_time.slice(0, 5);

            const bookableWindows = schedules
              .filter(s => {
                if (s.day_of_week !== jsDayOfWeek || !s.is_bookable) return false;
                if (isPublicInsurance && s.insurance_filter === 'private_only') return false;
                return true;
              })
              .map(s => ({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) }));

            if (bookableWindows.length === 0) continue;
            if (!bookableWindows.some(w => time >= w.start && time < w.end)) continue;
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
  }, [practitionerId, insuranceTypeId]);

  return { date, startTime, loading };
}

// =====================================================
// MFA Hooks (ORTHO-027)
// =====================================================

export function useMfaTreatmentTypes(specialtyId?: string | null) {
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
        .eq('patient_visible', true)
        .or(specialtyId ? `specialty_id.is.null,specialty_id.eq.${specialtyId}` : 'specialty_id.is.null,specialty_id.not.is.null')
        .order('sort_order');

      if (error) throw error;
      setData(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der MFA-Leistungen');
    } finally {
      setLoading(false);
    }
  }, [specialtyId]);

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

        // Lade nur die Daten der MFA-Slots (nicht alle IDs)
        const { data: slots, error } = await supabase
          .from('mfa_time_slots')
          .select('date')
          .gte('date', startDate)
          .lte('date', endDate);

        if (error) throw error;

        // Einzigartige Tage extrahieren
        const uniqueDates = [...new Set((slots || []).map(s => s.date))].sort();
        setData(uniqueDates);
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
      const mfaEmail = bookingData.patientData.email?.trim() || null;
      const mfaPhone = bookingData.patientData.phone?.trim() || null;

      const { data: allowed, error: rateLimitError } = await supabase
        .rpc('check_booking_rate_limit', { p_email: mfaEmail, p_phone: mfaPhone });

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

      // 2. Patient finden oder anlegen (Dedup via Name+Telefon)
      const patient = await findOrCreatePatient(bookingData.patientData);

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

      // 4. Bestätigungs-E-Mails / SMS (non-blocking, ORTHO-040)
      if (mfaEmail || mfaPhone) {
        supabase.functions.invoke('send-booking-confirmation', {
          body: { appointmentId: appointment.id, booking_type: 'mfa' }
        }).then(({ error }) => {
          if (error) console.error('Fehler beim Senden der MFA-Bestätigung:', error);
        });
      }

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
  additionalSlotIds?: string[];
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
      // 0. Rate Limit prüfen (max 3 Buchungen pro E-Mail/Telefon in 24h)
      const docEmail = bookingData.patientData.email?.trim() || null;
      const docPhone = bookingData.patientData.phone?.trim() || null;

      const { data: allowed, error: rateLimitError } = await supabase
        .rpc('check_booking_rate_limit', { p_email: docEmail, p_phone: docPhone });

      if (rateLimitError) {
        console.error('Rate limit check failed:', rateLimitError);
      } else if (allowed === false) {
        throw new Error('Sie haben bereits mehrere Termine gebucht. Bitte kontaktieren Sie die Praxis telefonisch.');
      }

      // 1. Patient finden oder anlegen (Dedup via Name+Telefon)
      const patient = await findOrCreatePatient(bookingData.patientData);

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

      // 2b. ORTHO-025: Block additional consecutive slots for multi-slot treatments
      if (bookingData.additionalSlotIds?.length) {
        for (const additionalSlotId of bookingData.additionalSlotIds) {
          const { error: blockError } = await supabase
            .from('appointments')
            .insert({
              patient_id: patient.id,
              treatment_type_id: bookingData.treatmentTypeId,
              time_slot_id: additionalSlotId,
              practitioner_id: bookingData.practitionerId,
              primary_appointment_id: appointment.id,
              status: 'confirmed'
            });

          if (blockError) {
            if (blockError.code === '23505') {
              throw new Error('Ein Folgeslot wurde leider gerade vergeben. Bitte wählen Sie einen anderen Termin.');
            }
            throw blockError;
          }
        }
      }

      // 3. Send confirmation emails / SMS (non-blocking, ORTHO-040)
      // Bestätigung an Patient (wenn E-Mail oder Telefon vorhanden)
      if (docEmail || docPhone) {
        supabase.functions.invoke('send-booking-confirmation', {
          body: { appointmentId: appointment.id }
        }).then(({ error }) => {
          if (error) console.error('Fehler beim Senden der Bestätigung:', error);
        });
      }

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
