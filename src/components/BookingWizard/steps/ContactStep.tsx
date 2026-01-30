import { useState, useMemo } from 'react';
import { Input, Button } from '../../';
import {
  useCreateBooking,
  useSpecialties,
  useInsuranceTypes,
  useTreatmentTypes,
  usePractitioners,
  useTimeSlots
} from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import type { BookingState } from '../BookingWizard';
import styles from '../BookingWizard.module.css';
import contactStyles from './ContactStep.module.css';

interface ContactStepProps {
  state: BookingState;
  onUpdateContact: (data: BookingState['contactData']) => void;
  onComplete: (appointmentId: string) => void;
  onBack: () => void;
  onGoToStep: (step: number) => void;
}

export function ContactStep({ state, onUpdateContact, onComplete, onBack, onGoToStep }: ContactStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { createBooking, loading, error: bookingError, clearError } = useCreateBooking();

  // Load data for summary
  const { data: specialties } = useSpecialties();
  const { data: insuranceTypes } = useInsuranceTypes();
  const { data: treatmentTypes } = useTreatmentTypes();
  const { data: practitioners } = usePractitioners(state.specialtyId);
  const { data: timeSlots } = useTimeSlots(state.selectedDate);

  const selectedSpecialty = useMemo(() =>
    specialties.find(s => s.id === state.specialtyId),
    [specialties, state.specialtyId]
  );

  const selectedInsurance = useMemo(() =>
    insuranceTypes.find(i => i.id === state.insuranceTypeId),
    [insuranceTypes, state.insuranceTypeId]
  );

  const selectedTreatment = useMemo(() =>
    treatmentTypes.find(t => t.id === state.treatmentTypeId),
    [treatmentTypes, state.treatmentTypeId]
  );

  const selectedPractitioner = useMemo(() =>
    practitioners.find(p => p.id === state.practitionerId),
    [practitioners, state.practitionerId]
  );

  const selectedSlot = useMemo(() =>
    timeSlots.find(s => s.id === state.timeSlotId),
    [timeSlots, state.timeSlotId]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => time.substring(0, 5);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!state.contactData.name.trim()) {
      newErrors.name = 'Bitte geben Sie Ihren Namen ein';
    }

    if (!state.contactData.email.trim()) {
      newErrors.email = 'Bitte geben Sie Ihre E-Mail-Adresse ein';
    } else if (!validateEmail(state.contactData.email)) {
      newErrors.email = 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
    }

    if (!state.contactData.phone.trim()) {
      newErrors.phone = 'Bitte geben Sie Ihre Telefonnummer ein';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!state.insuranceTypeId || !state.treatmentTypeId || !state.timeSlotId) return;

    clearError();

    const result = await createBooking({
      patientData: {
        name: state.contactData.name,
        email: state.contactData.email,
        phone: state.contactData.phone,
        insurance_type_id: state.insuranceTypeId
      },
      treatmentTypeId: state.treatmentTypeId,
      timeSlotId: state.timeSlotId,
      practitionerId: state.practitionerId
    });

    if (result) {
      onComplete(result.appointment.id);
    }
  };

  const handleInputChange = (field: keyof BookingState['contactData'], value: string) => {
    onUpdateContact({
      ...state.contactData,
      [field]: value
    });
    // Clear error when typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Kontaktdaten & Bestätigung</h2>
        <p className={styles.stepDescription}>
          Bitte geben Sie Ihre Kontaktdaten ein
        </p>
      </div>

      {/* Summary */}
      <div className={contactStyles.summary}>
        <h3 className={contactStyles.summaryTitle}>Ihre Buchung</h3>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(1)}>
          <span className={contactStyles.summaryLabel}>Fachgebiet</span>
          <span className={contactStyles.summaryValue}>{selectedSpecialty?.name}</span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(2)}>
          <span className={contactStyles.summaryLabel}>Versicherung</span>
          <span className={contactStyles.summaryValue}>{selectedInsurance?.name}</span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(3)}>
          <span className={contactStyles.summaryLabel}>Terminart</span>
          <span className={contactStyles.summaryValue}>
            {selectedTreatment?.name} ({selectedTreatment?.duration_minutes} Min.)
          </span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(4)}>
          <span className={contactStyles.summaryLabel}>Behandler</span>
          <span className={contactStyles.summaryValue}>
            {selectedPractitioner ? getPractitionerFullName(selectedPractitioner) : 'Keine Präferenz'}
          </span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(5)}>
          <span className={contactStyles.summaryLabel}>Datum</span>
          <span className={contactStyles.summaryValue}>
            {state.selectedDate && formatDate(state.selectedDate)}
          </span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(6)}>
          <span className={contactStyles.summaryLabel}>Uhrzeit</span>
          <span className={contactStyles.summaryValue}>
            {selectedSlot && formatTime(selectedSlot.start_time)} Uhr
          </span>
        </div>
      </div>

      {/* Contact Form */}
      <div className={contactStyles.form}>
        <Input
          label="Name *"
          type="text"
          placeholder="Ihr vollständiger Name"
          value={state.contactData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          error={errors.name}
          fullWidth
        />

        <Input
          label="E-Mail *"
          type="email"
          placeholder="ihre.email@beispiel.de"
          value={state.contactData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          error={errors.email}
          fullWidth
        />

        <Input
          label="Telefon *"
          type="tel"
          placeholder="0511 123456"
          value={state.contactData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          error={errors.phone}
          fullWidth
        />
      </div>

      <div className={contactStyles.hint}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>Stornierung ist bis 12 Stunden vor dem Termin möglich.</span>
      </div>

      {bookingError && (
        <div className={styles.error}>
          <div className={styles.errorTitle}>Fehler bei der Buchung</div>
          <p>{bookingError}</p>
          {bookingError.includes('vergeben') && (
            <button className={styles.retryButton} onClick={() => onGoToStep(6)}>
              Andere Uhrzeit wählen
            </button>
          )}
        </div>
      )}

      <div className={`${styles.navigation} ${styles.spaceBetween}`}>
        <button className={styles.backButton} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Zurück
        </button>

        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Wird gebucht...' : 'Termin buchen'}
        </Button>
      </div>
    </div>
  );
}
