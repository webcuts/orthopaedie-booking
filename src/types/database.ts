// =====================================================
// TypeScript-Typen für Datenbank-Entitäten
// Orthopädie Terminbuchungssystem
// =====================================================

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type ReminderType = '24h_before' | '6h_before';

// =====================================================
// Basis-Entitäten
// =====================================================

export interface InsuranceType {
  id: string;
  name: string;
  name_en?: string | null;
  name_tr?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  insurance_type_id: string;
  created_at: string;
}

export interface TreatmentType {
  id: string;
  name: string;
  name_en?: string | null;
  name_tr?: string | null;
  duration_minutes: number;
  description: string | null;
  description_en?: string | null;
  description_tr?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
}

// =====================================================
// Neue Entitäten (ORTHO-004)
// =====================================================

export interface Specialty {
  id: string;
  name: string;
  name_en?: string | null;
  name_tr?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Practitioner {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  specialty_id: string | null;
  is_active: boolean;
  available_from: string | null;
  created_at: string;
}

export interface PracticeHours {
  id: string;
  day_of_week: number; // 0 = Montag, 6 = Sonntag
  open_time: string;
  close_time: string;
  is_closed: boolean;
  created_at: string;
}

// =====================================================
// Individuelle Sprechzeiten (ORTHO-028)
// =====================================================

export interface PractitionerSchedule {
  id: string;
  practitioner_id: string;
  day_of_week: number; // JS getDay(): 0=Sonntag, 1=Montag, ..., 6=Samstag
  start_time: string;
  end_time: string;
  is_bookable: boolean;
  insurance_filter: 'all' | 'private_only';
  label: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

export interface EmailReminder {
  id: string;
  appointment_id: string;
  reminder_type: ReminderType;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
}

// =====================================================
// MFA-Entitäten (ORTHO-027)
// =====================================================

export interface MfaTreatmentType {
  id: string;
  name: string;
  name_en?: string | null;
  name_tr?: string | null;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
  specialty_id?: string | null;
  created_at: string;
}

export interface MfaTimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  max_parallel: number;
  created_at: string;
}

export interface MfaAppointment {
  id: string;
  patient_id: string;
  mfa_treatment_type_id: string;
  mfa_time_slot_id: string;
  status: AppointmentStatus;
  notes: string | null;
  cancel_token: string | null;
  consent_given: boolean;
  consent_timestamp: string | null;
  booked_by: string;
  language: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Appointment (erweitert)
// =====================================================

export interface Appointment {
  id: string;
  patient_id: string;
  treatment_type_id: string;
  time_slot_id: string;
  practitioner_id: string | null;
  status: AppointmentStatus;
  notes: string | null;
  language: string | null;
  cancellation_deadline: string | null;
  consent_given: boolean;
  consent_timestamp: string | null;
  cancel_token: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Typen für Formulareingaben
// =====================================================

export interface PatientInput {
  name: string;
  email?: string;
  phone?: string;
  insurance_type_id: string;
}

export interface AppointmentInput {
  patient_id: string;
  treatment_type_id: string;
  time_slot_id: string;
  practitioner_id?: string;
  notes?: string;
}

// =====================================================
// Erweiterte Typen mit Relationen
// =====================================================

export interface PractitionerWithSpecialty extends Practitioner {
  specialty?: Specialty;
}

export interface AppointmentWithDetails extends Appointment {
  patient?: Patient;
  treatment_type?: TreatmentType;
  time_slot?: TimeSlot;
  practitioner?: Practitioner;
}

// =====================================================
// Hilfsfunktionen
// =====================================================

export function getPractitionerFullName(practitioner: Practitioner): string {
  const parts = [];
  if (practitioner.title) parts.push(practitioner.title);
  parts.push(practitioner.first_name);
  parts.push(practitioner.last_name);
  return parts.join(' ');
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  return days[dayOfWeek] || '';
}
