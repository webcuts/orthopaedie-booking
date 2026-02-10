import { useState, useMemo } from 'react';
import { Input, Button } from '../../';
import {
  useCreateBooking,
  useSpecialties,
  useInsuranceTypes,
  useTreatmentTypes,
  usePractitioners
} from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import { sanitizeInput, validateName, validateEmail, validatePhone, FIELD_LIMITS } from '../../../utils/validation';
import { useTranslation, getLocalizedName } from '../../../i18n';
import type { BookingState } from '../BookingWizard';
import styles from '../BookingWizard.module.css';
import contactStyles from './ContactStep.module.css';

interface ContactStepProps {
  state: BookingState;
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

export function ContactStep({ state, onUpdateContact, onComplete, onBack, onGoToStep, wizardStartTime }: ContactStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const { createBooking, loading, error: bookingError, clearError } = useCreateBooking();
  const { t, language } = useTranslation();

  // Load data for summary
  const { data: specialties } = useSpecialties();
  const { data: insuranceTypes } = useInsuranceTypes();
  const { data: treatmentTypes } = useTreatmentTypes();
  const { data: practitioners } = usePractitioners(state.specialtyId);

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
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
    if (!state.insuranceTypeId || !state.treatmentTypeId || !state.timeSlotId) return;

    if (!consentGiven) {
      setConsentError(true);
      return;
    }

    clearError();

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

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(1)}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelSpecialty')}</span>
          <span className={contactStyles.summaryValue}>{selectedSpecialty?.name}</span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(2)}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelInsurance')}</span>
          <span className={contactStyles.summaryValue}>{selectedInsurance ? getLocalizedName(selectedInsurance, language) : ''}</span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(3)}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelTreatment')}</span>
          <span className={contactStyles.summaryValue}>
            {selectedTreatment ? getLocalizedName(selectedTreatment, language) : ''} ({selectedTreatment?.duration_minutes} {t('common.minutesShort')})
          </span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(4)}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelPractitioner')}</span>
          <span className={contactStyles.summaryValue}>
            {selectedPractitioner ? getPractitionerFullName(selectedPractitioner) : t('contact.noPreference')}
          </span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(5)}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelDate')}</span>
          <span className={contactStyles.summaryValue}>
            {state.selectedDate && formatDate(state.selectedDate)}
          </span>
        </div>

        <div className={contactStyles.summaryItem} onClick={() => onGoToStep(6)}>
          <span className={contactStyles.summaryLabel}>{t('contact.labelTime')}</span>
          <span className={contactStyles.summaryValue}>
            {state.selectedStartTime && formatTime(state.selectedStartTime)} {t('common.clock')}
          </span>
        </div>
      </div>

      {/* Contact Form */}
      <div className={contactStyles.form}>
        {/* Honeypot field - invisible to users, bots fill it */}
        <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
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
          {bookingError.includes('vergeben') && (
            <button className={styles.retryButton} onClick={() => onGoToStep(6)}>
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
