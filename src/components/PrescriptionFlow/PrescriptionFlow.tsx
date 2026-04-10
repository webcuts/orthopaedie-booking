import { useState } from 'react';
import { Container, Card, Input, Button } from '../';
import { LanguageProvider, LanguageSelector, useTranslation } from '../../i18n';
import { supabase } from '../../lib/supabaseClient';
import { sanitizeInput, validateName, validatePhone, validateEmail, FIELD_LIMITS } from '../../utils/validation';
import styles from './PrescriptionFlow.module.css';

type OrderType = 'rezept' | 'heilmittel';
type FlowStep = 'type' | 'quarterly' | 'contact' | 'success';

const ORDER_TYPES: { value: OrderType; labelKey: string; descKey: string; hintKey?: string; icon: string }[] = [
  { value: 'rezept', labelKey: 'prescription.typeRezept', descKey: 'prescription.typeRezeptDesc', hintKey: 'prescription.hintRezept', icon: '💊' },
  { value: 'heilmittel', labelKey: 'prescription.typeHeilmittel', descKey: 'prescription.typeHeilmittelDesc', hintKey: 'prescription.hintHeilmittel', icon: '🏥' },
];

function PrescriptionFlowInner({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<FlowStep>('type');
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSelectType = (type: OrderType) => {
    setOrderType(type);
    setStep('quarterly');
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const nameErr = validateName(name);
    if (nameErr) newErrors.name = nameErr;
    const phoneErr = validatePhone(phone);
    if (phoneErr) newErrors.phone = phoneErr;
    const emailErr = validateEmail(email);
    if (emailErr) newErrors.email = emailErr;
    if (!consentGiven) newErrors.consent = 'true';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !orderType) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Get or create patient
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('name', sanitizeInput(name.trim()))
        .eq('phone', phone.trim())
        .maybeSingle();

      let patientId: string;

      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        // Get default insurance type
        const { data: defaultInsurance } = await supabase
          .from('insurance_types')
          .select('id')
          .limit(1)
          .single();

        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            name: sanitizeInput(name.trim()),
            phone: phone.trim(),
            email: email.trim() || null,
            insurance_type_id: defaultInsurance?.id,
          })
          .select('id')
          .single();

        if (patientError || !newPatient) {
          throw new Error('Patient konnte nicht erstellt werden');
        }
        patientId = newPatient.id;
      }

      // Create prescription order
      const { error: orderError } = await supabase
        .from('prescription_orders')
        .insert({
          patient_id: patientId,
          order_type: orderType,
          note: note.trim() || null,
        });

      if (orderError) throw orderError;

      setStep('success');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Absenden');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="lg" className={styles.container}>
      <Card variant="elevated" padding="lg">
        <div className={styles.header}>
          <div className={styles.languageRow}>
            <LanguageSelector />
          </div>
          <h1 className={styles.title}>{t('prescription.title')}</h1>
          <p className={styles.subtitle}>Orthopädie Königstraße, Hannover</p>
        </div>

        {step === 'type' && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>{t('prescription.selectType')}</h2>
              <p className={styles.stepDesc}>{t('prescription.selectTypeDesc')}</p>
            </div>

            <div className={styles.typeGrid}>
              {ORDER_TYPES.map(({ value, labelKey, descKey, hintKey, icon }) => (
                <button
                  key={value}
                  className={styles.typeCard}
                  onClick={() => handleSelectType(value)}
                >
                  <span className={styles.typeIcon}>{icon}</span>
                  <span className={styles.typeLabel}>{t(labelKey)}</span>
                  <span className={styles.typeDesc}>{t(descKey)}</span>
                  {hintKey && (
                    <span className={styles.typeHint}>{t(hintKey)}</span>
                  )}
                </button>
              ))}
            </div>

            <button className={styles.backLink} onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              {t('prescription.backToChoice')}
            </button>
          </div>
        )}

        {step === 'quarterly' && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>{t('prescription.quarterlyTitle')}</h2>
              <p className={styles.stepDesc}>{t('prescription.quarterlyDesc')}</p>
            </div>

            <div className={styles.quarterlyActions}>
              <button
                className={styles.quarterlyYes}
                onClick={() => setStep('contact')}
              >
                {t('prescription.quarterlyYes')}
              </button>
              <button
                className={styles.quarterlyNo}
                disabled
              >
                {t('prescription.quarterlyNo')}
              </button>
            </div>

            <div className={styles.quarterlyWarning}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <span>{t('prescription.quarterlyWarning')}</span>
            </div>

            <div className={styles.actions}>
              <button className={styles.backButton} onClick={() => { setStep('type'); setOrderType(null); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                {t('common.back')}
              </button>
            </div>
          </div>
        )}

        {step === 'contact' && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>{t('prescription.contactTitle')}</h2>
              <p className={styles.stepDesc}>
                {t('prescription.selectedType')}: <strong>{t(ORDER_TYPES.find(o => o.value === orderType)?.labelKey || '')}</strong>
              </p>
            </div>

            <div className={styles.form}>
              <Input
                label={t('contact.nameLabel')}
                type="text"
                placeholder={t('contact.namePlaceholder')}
                value={name}
                onChange={(e) => { setName(sanitizeInput(e.target.value)); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                error={errors.name ? t(errors.name) : undefined}
                maxLength={FIELD_LIMITS.NAME_MAX}
                fullWidth
              />

              <Input
                label={t('contact.phoneLabel')}
                type="tel"
                placeholder={t('contact.phonePlaceholder')}
                value={phone}
                onChange={(e) => { setPhone(sanitizeInput(e.target.value)); if (errors.phone) setErrors(prev => ({ ...prev, phone: '' })); }}
                error={errors.phone ? t(errors.phone) : undefined}
                maxLength={FIELD_LIMITS.PHONE_MAX}
                fullWidth
              />

              <Input
                label={t('contact.emailLabel')}
                type="email"
                placeholder={t('contact.emailPlaceholder')}
                value={email}
                onChange={(e) => { setEmail(sanitizeInput(e.target.value)); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
                error={errors.email ? t(errors.email) : undefined}
                maxLength={FIELD_LIMITS.EMAIL_MAX}
                fullWidth
              />

              <div className={styles.noteField}>
                <label className={styles.noteLabel}>{t('prescription.noteLabel')}</label>
                <textarea
                  className={styles.noteTextarea}
                  placeholder={t('prescription.notePlaceholder')}
                  value={note}
                  onChange={(e) => setNote(sanitizeInput(e.target.value))}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <label className={styles.consent}>
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => { setConsentGiven(e.target.checked); if (e.target.checked && errors.consent) setErrors(prev => ({ ...prev, consent: '' })); }}
                  className={styles.consentCheckbox}
                />
                <span className={styles.consentText}>{t('contact.consent')}</span>
              </label>
              {errors.consent && (
                <div className={styles.consentError}>{t('contact.consentRequired')}</div>
              )}
            </div>

            {submitError && (
              <div className={styles.error}>{submitError}</div>
            )}

            <div className={styles.pickupHint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <span>{t('prescription.pickupHint')}</span>
            </div>

            <div className={styles.actions}>
              <button className={styles.backButton} onClick={() => setStep('type')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                {t('common.back')}
              </button>
              <Button variant="primary" size="lg" onClick={handleSubmit} disabled={submitting}>
                {submitting ? t('prescription.submitting') : t('prescription.submit')}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className={styles.success}>
            <div className={styles.successIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 className={styles.successTitle}>{t('prescription.successTitle')}</h2>
            <p className={styles.successText}>{t('prescription.successText')}</p>

            <div className={styles.pickupBox}>
              <strong>{t('prescription.pickupTitle')}</strong>
              <p>{t('prescription.pickupTime')}</p>
            </div>

            <button className={styles.resetButton} onClick={onBack}>
              {t('prescription.backToStart')}
            </button>
          </div>
        )}
      </Card>
    </Container>
  );
}

export function PrescriptionFlow({ onBack }: { onBack: () => void }) {
  return (
    <LanguageProvider>
      <PrescriptionFlowInner onBack={onBack} />
    </LanguageProvider>
  );
}
