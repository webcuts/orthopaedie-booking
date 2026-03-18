import { useState } from 'react';
import { useAllPractitioners } from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import { useTranslation } from '../../../i18n';
import type { PractitionerAbsenceInfo } from '../../../hooks/useSupabase';
import styles from '../BookingWizard.module.css';

interface DoctorSelectStepProps {
  onSelectDoctor: (practitionerId: string, specialtyId: string) => void;
  onSelectMfa: () => void;
}

const REASON_KEYS: Record<string, string> = {
  sick: 'doctorSelect.reasonSick',
  vacation: 'doctorSelect.reasonVacation',
  other: 'doctorSelect.reasonOther',
};

export function DoctorSelectStep({ onSelectDoctor, onSelectMfa }: DoctorSelectStepProps) {
  const { data: practitioners, absentMap, loading, error } = useAllPractitioners();
  const { t, language } = useTranslation();
  const [absenceOverlay, setAbsenceOverlay] = useState<{
    name: string;
    absence: PractitionerAbsenceInfo;
  } | null>(null);

  const localeMap: Record<string, string> = {
    de: 'de-DE', en: 'en-US', tr: 'tr-TR', ru: 'ru-RU', ar: 'ar-SA',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getReturnDate = (endDate: string) => {
    const date = new Date(endDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      day: 'numeric',
      month: 'long',
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>{t('doctorSelect.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorTitle}>{t('common.error')}</div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('doctorSelect.title')}</h2>
        <p className={styles.stepDescription}>
          {t('doctorSelect.description')}
        </p>
      </div>

      <div className={styles.doctorGrid}>
        {practitioners.map((practitioner) => {
          const absence = absentMap.get(practitioner.id);
          const isAbsent = !!absence;
          const fullName = getPractitionerFullName(practitioner);

          return (
            <button
              key={practitioner.id}
              className={`${styles.doctorCard} ${isAbsent ? styles.doctorCardAbsent : ''}`}
              onClick={() => {
                if (isAbsent) {
                  setAbsenceOverlay({ name: fullName, absence });
                } else {
                  onSelectDoctor(practitioner.id, practitioner.specialty_id!);
                }
              }}
            >
              {practitioner.image_url ? (
                <div className={styles.doctorCardImage}>
                  <img
                    src={practitioner.image_url}
                    alt={fullName}
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className={styles.doctorCardInitials}>
                  <span>
                    {practitioner.first_name[0]}{practitioner.last_name[0]}
                  </span>
                </div>
              )}
              <div className={styles.doctorCardInfo}>
                <div className={styles.doctorCardName}>
                  {fullName}
                </div>
                {isAbsent && (
                  <div className={styles.doctorCardUnavailable}>
                    {t('doctorSelect.unavailable')}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {/* MFA Card */}
        <button
          className={`${styles.doctorCard} ${styles.mfaCard}`}
          onClick={onSelectMfa}
        >
          <div className={styles.mfaCardIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <div className={styles.doctorCardInfo}>
            <div className={styles.doctorCardName}>
              {t('doctorSelect.mfaTitle')}
            </div>
            <div className={styles.doctorCardSpecialty}>
              {t('doctorSelect.mfaSubtitle')}
            </div>
          </div>
        </button>
      </div>

      {/* Absence Info Overlay */}
      {absenceOverlay && (
        <div className={styles.absenceOverlay} onClick={() => setAbsenceOverlay(null)}>
          <div className={styles.absenceModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.absenceHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <span>{t('doctorSelect.unavailableTitle')}</span>
            </div>
            <p className={styles.absenceText}>
              {t('doctorSelect.unavailableMessage', {
                name: absenceOverlay.name,
                start: formatDate(absenceOverlay.absence.start_date),
                end: formatDate(absenceOverlay.absence.end_date),
                reason: t(REASON_KEYS[absenceOverlay.absence.reason] || 'doctorSelect.reasonOther'),
              })}
            </p>
            {absenceOverlay.absence.public_message && (
              <p className={styles.absencePublicMessage}>
                {absenceOverlay.absence.public_message}
              </p>
            )}
            <p className={styles.absenceHint}>
              {t('doctorSelect.unavailableHint', {
                returnDate: getReturnDate(absenceOverlay.absence.end_date),
              })}
            </p>
            <button
              className={styles.absenceCloseButton}
              onClick={() => setAbsenceOverlay(null)}
            >
              {t('doctorSelect.understood')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
