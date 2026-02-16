import { useMemo } from 'react';
import { Button } from '../../';
import {
  useSpecialties,
  useTreatmentTypes,
  usePractitioners,
  useMfaTreatmentTypes
} from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import { useTranslation, getLocalizedName } from '../../../i18n';
import type { BookingState } from '../BookingWizard';
import styles from './SuccessStep.module.css';

interface SuccessStepProps {
  state: BookingState;
  onReset: () => void;
}

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR'
};

export function SuccessStep({ state, onReset }: SuccessStepProps) {
  const { data: specialties } = useSpecialties();
  const { data: treatmentTypes } = useTreatmentTypes();
  const { data: practitioners } = usePractitioners(state.specialtyId);
  const { data: mfaTreatmentTypes } = useMfaTreatmentTypes();
  const { t, language } = useTranslation();

  const isMfa = state.bookingType === 'mfa';

  const selectedSpecialty = useMemo(() =>
    specialties.find(s => s.id === state.specialtyId),
    [specialties, state.specialtyId]
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
    const date = new Date(dateStr);
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => time.substring(0, 5);

  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <h1 className={styles.title}>
        {!isMfa && selectedPractitioner
          ? t('success.titleWithPractitioner', { name: getPractitionerFullName(selectedPractitioner) })
          : t('success.title')
        }
      </h1>
      <p
        className={styles.subtitle}
        dangerouslySetInnerHTML={{ __html: t('success.subtitle', { email: state.contactData.email }) }}
      />

      <div className={styles.details}>
        <h2 className={styles.detailsTitle}>{t('success.detailsTitle')}</h2>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t('success.labelDateTime')}</span>
          <span className={styles.detailValue}>
            {isMfa ? (
              <>
                {state.mfaSelectedDate && formatDate(state.mfaSelectedDate)}
                <br />
                {state.mfaSelectedStartTime && formatTime(state.mfaSelectedStartTime)} {t('common.clock')}
              </>
            ) : (
              <>
                {state.selectedDate && formatDate(state.selectedDate)}
                <br />
                {state.selectedStartTime && formatTime(state.selectedStartTime)} {t('common.clock')}
              </>
            )}
          </span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t('success.labelTreatment')}</span>
          <span className={styles.detailValue}>
            {isMfa
              ? (selectedMfaTreatment ? getLocalizedName(selectedMfaTreatment, language) : '')
              : (selectedTreatment ? getLocalizedName(selectedTreatment, language) : '')
            }
          </span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t('success.labelSpecialty')}</span>
          <span className={styles.detailValue}>
            {selectedSpecialty?.name}
          </span>
        </div>

        {isMfa ? (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{t('success.labelPractitioner')}</span>
            <span className={styles.detailValue}>
              {t('contact.mfaProvider')}
            </span>
          </div>
        ) : selectedPractitioner && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{t('success.labelPractitioner')}</span>
            <span className={styles.detailValue}>
              {getPractitionerFullName(selectedPractitioner)}
            </span>
          </div>
        )}

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t('success.labelPatient')}</span>
          <span className={styles.detailValue}>
            {state.contactData.name}
          </span>
        </div>
      </div>

      <div className={styles.address}>
        <h3>{t('success.addressTitle')}</h3>
        <p>Orthopädie Königstraße</p>
        <p>Königstraße 51</p>
        <p>30175 Hannover</p>
      </div>

      <div className={styles.reminder}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div dangerouslySetInnerHTML={{ __html: t('success.reminder') }} />
      </div>

      <div className={styles.actions}>
        <Button variant="primary" onClick={onReset}>
          {t('success.bookAnother')}
        </Button>
      </div>
    </div>
  );
}
