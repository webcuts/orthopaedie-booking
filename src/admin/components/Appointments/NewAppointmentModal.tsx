import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  useAdminCreateBooking,
  useAdminAvailableSlots,
} from '../../hooks';
import { sanitizeInput, validateName, validateEmail, validatePhone, validateNotes, FIELD_LIMITS } from '../../../utils/validation';
import styles from './NewAppointmentModal.module.css';

interface Practitioner {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
}

interface TreatmentType {
  id: string;
  name: string;
  duration_minutes: number;
  is_active: boolean;
}

interface InsuranceType {
  id: string;
  name: string;
}

interface NewAppointmentModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function NewAppointmentModal({ onClose, onCreated }: NewAppointmentModalProps) {
  // Reference data
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);

  // Form state
  const [practitionerId, setPractitionerId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlotId, setTimeSlotId] = useState('');
  const [treatmentTypeId, setTreatmentTypeId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const { createBooking, loading, error: bookingError, clearError } = useAdminCreateBooking();
  const { slots, loading: slotsLoading } = useAdminAvailableSlots(
    selectedDate || null,
    practitionerId || null
  );

  // Load reference data
  useEffect(() => {
    async function loadData() {
      const [practRes, treatRes, insRes] = await Promise.all([
        supabase.from('practitioners').select('id, title, first_name, last_name').eq('is_active', true).order('last_name'),
        supabase.from('treatment_types').select('id, name, duration_minutes, is_active').eq('is_active', true).order('name'),
        supabase.from('insurance_types').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (practRes.data) setPractitioners(practRes.data);
      if (treatRes.data) setTreatmentTypes(treatRes.data);
      if (insRes.data) setInsuranceTypes(insRes.data);
    }
    loadData();
  }, []);

  // Reset slot selection when practitioner or date changes
  useEffect(() => {
    setTimeSlotId('');
  }, [practitionerId, selectedDate]);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!practitionerId) newErrors.practitionerId = 'Pflichtfeld';
    if (!selectedDate) newErrors.selectedDate = 'Pflichtfeld';
    if (!timeSlotId) newErrors.timeSlotId = 'Bitte wählen Sie einen Zeitslot';
    if (!treatmentTypeId) newErrors.treatmentTypeId = 'Pflichtfeld';
    if (!insuranceTypeId) newErrors.insuranceTypeId = 'Pflichtfeld';

    const nameError = validateName(patientName);
    if (nameError) newErrors.patientName = nameError;

    if (patientEmail.trim()) {
      const emailError = validateEmail(patientEmail);
      if (emailError) newErrors.patientEmail = emailError;
    }

    if (patientPhone.trim()) {
      const phoneError = validatePhone(patientPhone);
      if (phoneError) newErrors.patientPhone = phoneError;
    }

    const notesError = validateNotes(notes);
    if (notesError) newErrors.notes = notesError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [practitionerId, selectedDate, timeSlotId, treatmentTypeId, insuranceTypeId, patientName, patientEmail, patientPhone, notes]);

  const handleSubmit = async () => {
    if (!validate()) return;
    clearError();

    const result = await createBooking({
      practitionerId,
      timeSlotId,
      treatmentTypeId,
      insuranceTypeId,
      patientName: sanitizeInput(patientName.trim()),
      patientEmail: patientEmail.trim() || undefined,
      patientPhone: patientPhone.trim() || undefined,
      notes: sanitizeInput(notes.trim()) || undefined,
    });

    if (result.success) {
      setSuccess(true);
      onCreated();
    }
  };

  const todayStr = formatLocalDate(new Date());

  if (success) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h2 className={styles.title}>Neuer Termin</h2>
            <button onClick={onClose} className={styles.closeButton}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className={styles.content}>
            <div className={styles.success}>
              <svg className={styles.successIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h3 className={styles.successTitle}>Termin erfolgreich erstellt</h3>
              <p className={styles.successText}>
                Der Termin für {patientName} wurde als bestätigt gespeichert.
              </p>
            </div>
          </div>
          <div className={styles.footer}>
            <button onClick={onClose} className={styles.submitButton}>
              Schließen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Neuer Termin</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {bookingError && (
            <div className={styles.error}>{bookingError}</div>
          )}

          {/* Termin */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Termin</h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Behandler <span className={styles.required}>*</span>
                </label>
                <select
                  className={`${styles.select} ${errors.practitionerId ? styles.inputError : ''}`}
                  value={practitionerId}
                  onChange={(e) => {
                    setPractitionerId(e.target.value);
                    setErrors((prev) => ({ ...prev, practitionerId: '' }));
                  }}
                >
                  <option value="">Bitte wählen</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title ? `${p.title} ` : ''}{p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
                {errors.practitionerId && <p className={styles.errorText}>{errors.practitionerId}</p>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Datum <span className={styles.required}>*</span>
                </label>
                <input
                  type="date"
                  className={`${styles.input} ${errors.selectedDate ? styles.inputError : ''}`}
                  value={selectedDate}
                  min={todayStr}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setErrors((prev) => ({ ...prev, selectedDate: '' }));
                  }}
                />
                {errors.selectedDate && <p className={styles.errorText}>{errors.selectedDate}</p>}
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>
                  Uhrzeit <span className={styles.required}>*</span>
                </label>
                {!practitionerId || !selectedDate ? (
                  <div className={styles.noSlots}>
                    Bitte wählen Sie zuerst einen Behandler und ein Datum.
                  </div>
                ) : slotsLoading ? (
                  <div className={styles.slotsLoading}>Lade verfügbare Zeiten...</div>
                ) : slots.length === 0 ? (
                  <div className={styles.noSlots}>
                    Keine verfügbaren Zeitslots für diesen Tag und Behandler.
                  </div>
                ) : (
                  <div className={styles.slotGrid}>
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={`${styles.slotButton} ${timeSlotId === slot.id ? styles.selected : ''}`}
                        onClick={() => {
                          setTimeSlotId(slot.id);
                          setErrors((prev) => ({ ...prev, timeSlotId: '' }));
                        }}
                      >
                        {slot.start_time.substring(0, 5)}
                      </button>
                    ))}
                  </div>
                )}
                {errors.timeSlotId && <p className={styles.errorText}>{errors.timeSlotId}</p>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Behandlungsart <span className={styles.required}>*</span>
                </label>
                <select
                  className={`${styles.select} ${errors.treatmentTypeId ? styles.inputError : ''}`}
                  value={treatmentTypeId}
                  onChange={(e) => {
                    setTreatmentTypeId(e.target.value);
                    setErrors((prev) => ({ ...prev, treatmentTypeId: '' }));
                  }}
                >
                  <option value="">Bitte wählen</option>
                  {treatmentTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.duration_minutes} Min.)
                    </option>
                  ))}
                </select>
                {errors.treatmentTypeId && <p className={styles.errorText}>{errors.treatmentTypeId}</p>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Versicherung <span className={styles.required}>*</span>
                </label>
                <select
                  className={`${styles.select} ${errors.insuranceTypeId ? styles.inputError : ''}`}
                  value={insuranceTypeId}
                  onChange={(e) => {
                    setInsuranceTypeId(e.target.value);
                    setErrors((prev) => ({ ...prev, insuranceTypeId: '' }));
                  }}
                >
                  <option value="">Bitte wählen</option>
                  {insuranceTypes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                {errors.insuranceTypeId && <p className={styles.errorText}>{errors.insuranceTypeId}</p>}
              </div>
            </div>
          </section>

          {/* Patient */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Patient</h3>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>
                  Name <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  className={`${styles.input} ${errors.patientName ? styles.inputError : ''}`}
                  placeholder="Vor- und Nachname"
                  value={patientName}
                  maxLength={FIELD_LIMITS.NAME_MAX}
                  onChange={(e) => {
                    setPatientName(sanitizeInput(e.target.value));
                    setErrors((prev) => ({ ...prev, patientName: '' }));
                  }}
                />
                {errors.patientName && <p className={styles.errorText}>{errors.patientName}</p>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>E-Mail</label>
                <input
                  type="email"
                  className={`${styles.input} ${errors.patientEmail ? styles.inputError : ''}`}
                  placeholder="Optional"
                  value={patientEmail}
                  maxLength={FIELD_LIMITS.EMAIL_MAX}
                  onChange={(e) => {
                    setPatientEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, patientEmail: '' }));
                  }}
                />
                {errors.patientEmail && <p className={styles.errorText}>{errors.patientEmail}</p>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Telefon</label>
                <input
                  type="tel"
                  className={`${styles.input} ${errors.patientPhone ? styles.inputError : ''}`}
                  placeholder="Optional"
                  value={patientPhone}
                  maxLength={FIELD_LIMITS.PHONE_MAX}
                  onChange={(e) => {
                    setPatientPhone(e.target.value);
                    setErrors((prev) => ({ ...prev, patientPhone: '' }));
                  }}
                />
                {errors.patientPhone && <p className={styles.errorText}>{errors.patientPhone}</p>}
              </div>
            </div>
          </section>

          {/* Notizen */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Notizen</h3>
            <textarea
              className={`${styles.textarea} ${errors.notes ? styles.inputError : ''}`}
              placeholder="z.B. Patient kommt mit Überweisung"
              value={notes}
              maxLength={FIELD_LIMITS.NOTES_MAX}
              onChange={(e) => {
                setNotes(sanitizeInput(e.target.value));
                setErrors((prev) => ({ ...prev, notes: '' }));
              }}
            />
            {errors.notes && <p className={styles.errorText}>{errors.notes}</p>}
          </section>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelButton}>
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Wird gebucht...' : 'Termin buchen'}
          </button>
        </div>
      </div>
    </div>
  );
}
