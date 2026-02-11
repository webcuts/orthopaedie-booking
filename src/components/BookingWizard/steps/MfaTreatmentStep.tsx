import { useMfaTreatmentTypes } from '../../../hooks/useSupabase';
import { useTranslation, getLocalizedName } from '../../../i18n';
import styles from '../BookingWizard.module.css';

interface MfaTreatmentStepProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}

export function MfaTreatmentStep({ selectedId, onSelect, onBack }: MfaTreatmentStepProps) {
  const { data: treatmentTypes, loading, error, refetch } = useMfaTreatmentTypes();
  const { t, language } = useTranslation();

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>{t('mfaTreatment.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorTitle}>{t('common.error')}</div>
        <p>{error}</p>
        <button className={styles.retryButton} onClick={refetch}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('mfaTreatment.title')}</h2>
        <p className={styles.stepDescription}>
          {t('mfaTreatment.description')}
        </p>
      </div>

      <div className={styles.selectionGrid}>
        {treatmentTypes.map((treatment) => (
          <button
            key={treatment.id}
            className={`${styles.selectionCard} ${selectedId === treatment.id ? styles.selected : ''}`}
            onClick={() => onSelect(treatment.id)}
          >
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>{getLocalizedName(treatment, language)}</div>
              <div className={styles.cardSubtitle}>
                {treatment.duration_minutes} {t('common.minutesShort')}
              </div>
            </div>
            <svg className={styles.cardIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      <div className={styles.navigation}>
        <button className={styles.backButton} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
