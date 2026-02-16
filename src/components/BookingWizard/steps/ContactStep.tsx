import { useState, useMemo } from 'react';
import { Input, Button } from '../../';
import {
  useCreateBooking,
  useCreateMfaBooking,
  useSpecialties,
  useInsuranceTypes,
  useTreatmentTypes,
  usePractitioners,
  useMfaTreatmentTypes
} from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import { sanitizeInput, validateName, validateEmail, validatePhone, FIELD_LIMITS } from '../../../utils/validation';
import { useTranslation, getLocalizedName } from '../../../i18n';
import type { BookingState, StepType } from '../BookingWizard';
import styles from '../BookingWizard.module.css';
import contactStyles from './ContactStep.module.css';

interface ContactStepProps {
  state: BookingState;
  steps: StepType[];
  onUpdateContact: (data: BookingState['contactData']) => void;
  onComplete: (appointmentId: string) => void;
  onBack: () => void;
  onGoToStep: (step: number) => void;
  wizardStartTime: number;
}

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR'
};

export function ContactStep({ state, steps, onUpdateContact, onComplete, onBack, onGoToStep, wizardStartTime }: ContactStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const { createBooking, loading: doctorLoading, error: doctorError, clearError: clearDoctorError } = useCreateBooking();
  const { createBooking: createMfaBooking, loading: mfaLoading, error: mfaError, clearError: clearMfaError } = useCreateMfaBooking();
  const { t, language } = useTranslation();

  const isMfa = state.bookingType === 'mfa';
  const loading = isMfa ? mfaLoading : doctorLoading;
  const bookingError = isMfa ? mfaError : doctorError;
  const clearError = isMfa ? clearMfaError : clearDoctorError;

  // Helper: find step number by step type
  const stepNumberOf = (stepType: StepType) => {
    const idx = steps.indexOf(stepType);
    return idx >= 0 ? idx + 1 : 1;
  };

  // Load data for summary
  const { data: specialties } = useSpecialties();
  const { data: insuranceTypes } = useInsuranceTypes();
  const { data: treatmentTypes } = useTreatmentTypes();
  const { data: practitioners } = usePractitioners(state.specialtyId);
  const { data: mfaTreatmentTypes } = useMfaTreatmentTypes();

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

  const selectedMfaTreatment = useMemo(() =>
    mfaTreatmentTypes.find(t => t.id === state.mfaTreatmentTypeId),
    [mfaTreatmentTypes, state.mfaTreatmentTypeId]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => time.substring(0, 5);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const nameError = validateName(state.contactData.name);
    if (nameError) newErrors.name = nameError;

    const emailError = validateEmail(state.contactData.email);
    if (emailError) newErrors.email = emailError;

    if (state.contactData.phone.trim()) {
      const phoneError = validatePhone(state.contactData.phone);
      if (phoneError) newErrors.phone = phoneError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Honeypot: stille Ablehnung mit Fake-Success für Bots
    if (honeypot) {
      onComplete('fake-' + crypto.randomUUID());
      return;
    }

    // Timing: reject if form was filled too fast (< 3s since wizard start)
    if (Date.now() - wizardStartTime < 3000) return;

    if (!validateForm()) return;
    if (!state.insuranceTypeId) return;

    if (!consentGiven) {
      setConsentError(true);
      return;
    }

    clearError();

    if (isMfa) {
      // MFA Booking
      if (!state.mfaTreatmentTypeId || !state.mfaTimeSlotId) return;

      const result = await createMfaBooking({
        patientData: {
          name: sanitizeInput(state.contactData.name.trim()),
          email: state.contactData.email.trim(),
          phone: state.contactData.phone.trim(),
          insurance_type_id: state.insuranceTypeId
        },
        mfaTreatmentTypeId: state.mfaTreatmentTypeId,
        mfaTimeSlotId: state.mfaTimeSlotId,
        language,
        consent_given: true,
        consent_timestamp: new Date().toISOString()
      });

      if (result) {
        onComplete(result.appointment.id);
      }
    } else {
      // Doctor Booking
      if (!state.treatmentTypeId || !state.timeSlotId) return;

      const result = await createBooking({
        patientData: {
          name: sanitizeInput(state.contactData.name.trim()),
          email: state.contactData.email.trim(),
          phone: state.contactData.phone.trim(),
          insurance_type_id: state.insuranceTypeId
        },
        treatmentTypeId: state.treatmentTypeId,
        timeSlotId: state.timeSlotId,
        practitionerId: state.practitionerId,
        language,
        consent_given: true,
        consent_timestamp: new Date().toISOString()
      });

      if (result) {
        onComplete(result.appointment.id);
      }
    }
  };

  const handleInputChange = (field: keyof BookingState['contactData'], value: string) => {
    const sanitized = sanitizeInput(value);
    onUpdateContact({
      ...state.contactData,
      [field]: sanitized
    });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Determine display date/time based on booking type
  const displayDate = isMfa ? state.mfaSelectedDate : state.selectedDate;
  const displayTime = isMfa ? state.mfaSelectedStartTime : state.selectedStartTime;

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('contact.title')}</h2>
        <p className={styles.stepDescription}>
          {t('contact.description')}
        </p>
      </div>

      {/* Summary */}
      <div className={contactStyles.summary}>
        <h3 className={contactStyles.summaryTitle}>{t('contact.summaryTitle')}</h3>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('specialty'))}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelSpecialty')}</span>
          <span className={contactStyles.summaryValue}>{selectedSpecialty?.name}</span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('insurance'))}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelInsurance')}</span>
          <span className={contactStyles.summaryValue}>{selectedInsurance ? getLocalizedName(selectedInsurance, language) : ''}</span>
        </div>

        {isMfa ? (
          <>
            <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('mfaTreatment'))}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelMfaTreatment')}</span>
              <span className={contactStyles.summaryValue}>
                {selectedMfaTreatment ? getLocalizedName(selectedMfaTreatment, language) : ''} ({selectedMfaTreatment?.duration_minutes} {t('common.minutesShort')})
              </span>
            </div>

            <div className={contactStyles.summaryItem}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelPractitioner')}</span>
              <span className={contactStyles.summaryValue}>{t('contact.mfaProvider')}</span>
            </div>

            <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('mfaCalendar'))}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelDate')}</span>
              <span className={contactStyles.summaryValue}>
                {displayDate && formatDate(displayDate)}
              </span>
            </div>

            <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('mfaCalendar'))}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelTime')}</span>
              <span className={contactStyles.summaryValue}>
                {displayTime && formatTime(displayTime)} {t('common.clock')}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('treatment'))}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelTreatment')}</span>
              <span className={contactStyles.summaryValue}>
                {selectedTreatment ? getLocalizedName(selectedTreatment, language) : ''} ({selectedTreatment?.duration_minutes} {t('common.minutesShort')})
              </span>
            </div>

            <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('practitioner'))}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelPractitioner')}</span>
              <span className={contactStyles.summaryValue}>
                {selectedPractitioner ? getPractitionerFullName(selectedPractitioner) : t('contact.noPreference')}
              </span>
            </div>

            <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('date'))}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelDate')}</span>
              <span className={contactStyles.summaryValue}>
                {displayDate && formatDate(displayDate)}
              </span>
            </div>

            <div className={contactStyles.summaryItem} onClick={() => onGoToStep(stepNumberOf('time'))}>
              <span className={contactStyles.summaryLabel}>{t('contact.labelTime')}</span>
              <span className={contactStyles.summaryValue}>
                {displayTime && formatTime(displayTime)} {t('common.clock')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Contact Form */}
      <div className={contactStyles.form}>
        {/* Honeypot field - invisible to users, bots fill it */}
        <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
          <input
            type="text"
            name="hp_x_field"
            id="hp_x_field"
            tabIndex={-1}
            autoComplete="nope"
            data-form-type="other"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <Input
          label={t('contact.nameLabel')}
          type="text"
          placeholder={t('contact.namePlaceholder')}
          value={state.contactData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          error={errors.name ? t(errors.name) : undefined}
          maxLength={FIELD_LIMITS.NAME_MAX}
          fullWidth
        />

        <Input
          label={t('contact.emailLabel')}
          type="email"
          placeholder={t('contact.emailPlaceholder')}
          value={state.contactData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          error={errors.email ? t(errors.email) : undefined}
          maxLength={FIELD_LIMITS.EMAIL_MAX}
          fullWidth
        />

        <Input
          label={t('contact.phoneLabel')}
          type="tel"
          placeholder={t('contact.phonePlaceholder')}
          value={state.contactData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          error={errors.phone ? t(errors.phone) : undefined}
          maxLength={FIELD_LIMITS.PHONE_MAX}
          fullWidth
        />
      </div>

      {/* DSGVO Consent Checkbox */}
      <label className={contactStyles.consent}>
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => {
            setConsentGiven(e.target.checked);
            if (e.target.checked) setConsentError(false);
          }}
          className={contactStyles.consentCheckbox}
        />
        <span className={contactStyles.consentText}>{t('contact.consent')}</span>
      </label>
      {consentError && (
        <div className={contactStyles.consentError}>{t('contact.consentRequired')}</div>
      )}

      <div className={contactStyles.hint}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>{t('contact.cancellationHint')}</span>
      </div>

      {bookingError && (
        <div className={styles.error}>
          <div className={styles.errorTitle}>{t('contact.bookingError')}</div>
          <p>{bookingError}</p>
          {bookingError.includes('vergeben') && !isMfa && (
            <button className={styles.retryButton} onClick={() => onGoToStep(stepNumberOf('time'))}>
              {t('contact.chooseOtherTime')}
            </button>
          )}
          {bookingError.includes('verfügbar') && isMfa && (
            <button className={styles.retryButton} onClick={() => onGoToStep(stepNumberOf('mfaCalendar'))}>
              {t('contact.chooseOtherTime')}
            </button>
          )}
        </div>
      )}

      <div className={`${styles.navigation} ${styles.spaceBetween}`}>
        <button className={styles.backButton} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('common.back')}
        </button>

        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? t('common.bookingLoading') : t('common.booking')}
        </Button>
      </div>
    </div>
  );
}
