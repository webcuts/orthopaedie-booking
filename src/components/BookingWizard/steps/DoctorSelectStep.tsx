import { useAllPractitioners } from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import { useTranslation } from '../../../i18n';
import styles from '../BookingWizard.module.css';

interface DoctorSelectStepProps {
  onSelectDoctor: (practitionerId: string, specialtyId: string) => void;
  onSelectMfa: () => void;
}

export function DoctorSelectStep({ onSelectDoctor, onSelectMfa }: DoctorSelectStepProps) {
  const { data: practitioners, loading, error } = useAllPractitioners();
  const { t } = useTranslation();

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
        {practitioners.map((practitioner) => (
          <button
            key={practitioner.id}
            className={styles.doctorCard}
            onClick={() => onSelectDoctor(practitioner.id, practitioner.specialty_id!)}
          >
            {practitioner.image_url ? (
              <div className={styles.doctorCardImage}>
                <img
                  src={practitioner.image_url}
                  alt={getPractitionerFullName(practitioner)}
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
                {getPractitionerFullName(practitioner)}
              </div>
            </div>
          </button>
        ))}

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
