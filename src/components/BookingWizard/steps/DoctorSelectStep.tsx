import { useAllPractitioners, type PractitionerAbsenceInfo } from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import { useTranslation } from '../../../i18n';
import styles from '../BookingWizard.module.css';

interface DoctorSelectStepProps {
  onSelectDoctor: (practitionerId: string, specialtyId: string) => void;
  onSelectMfa: () => void;
}

export function DoctorSelectStep({ onSelectDoctor, onSelectMfa }: DoctorSelectStepProps) {
  const { data: practitioners, absentMap, loading, error } = useAllPractitioners();
  const { t, language } = useTranslation();

  const localeMap: Record<string, string> = {
    de: 'de-DE', en: 'en-US', tr: 'tr-TR', ru: 'ru-RU', ar: 'ar-SA',
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      day: 'numeric', month: 'short',
    });
  };

  // Zeigt den tatsächlichen Abwesenheitsgrund an: eine vom Admin gesetzte
  // öffentliche Nachricht hat Vorrang, sonst das lokalisierte reason-Label.
  const getAbsenceReasonLabel = (absence: PractitionerAbsenceInfo): string => {
    const message = absence.public_message?.trim();
    if (message) return message;
    switch (absence.reason) {
      case 'sick': return t('doctorSelect.reasonSick');
      case 'vacation': return t('doctorSelect.reasonVacation');
      default: return t('doctorSelect.reasonOther');
    }
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
          const fullName = getPractitionerFullName(practitioner);

          return (
            <button
              key={practitioner.id}
              className={styles.doctorCard}
              onClick={() => onSelectDoctor(practitioner.id, practitioner.specialty_id!)}
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
                {absence && (
                  <div className={styles.doctorCardAbsenceHint}>
                    {t('doctorSelect.absenceHint', {
                      reason: getAbsenceReasonLabel(absence),
                      start: formatDateShort(absence.start_date),
                      end: formatDateShort(absence.end_date),
                    })}
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

    </div>
  );
}
