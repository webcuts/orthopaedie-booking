import { useTranslation } from '../../../i18n';
import styles from '../BookingWizard.module.css';

interface BookingTypeStepProps {
  selectedType: 'doctor' | 'mfa' | null;
  onSelect: (type: 'doctor' | 'mfa') => void;
  onBack: () => void;
}

export function BookingTypeStep({ selectedType, onSelect, onBack }: BookingTypeStepProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('bookingType.title')}</h2>
        <p className={styles.stepDescription}>
          {t('bookingType.description')}
        </p>
      </div>

      <div className={styles.selectionGrid}>
        <button
          className={`${styles.selectionCard} ${selectedType === 'doctor' ? styles.selected : ''}`}
          onClick={() => onSelect('doctor')}
        >
          <div className={styles.cardContent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <path d="M4.8 2.3A2 2 0 0 0 3 4.3v15.4a2 2 0 0 0 1.8 2h.6a2.6 2.6 0 0 0 0-1.2 2.6 2.6 0 0 1 4.8 0 2.6 2.6 0 0 0 0 1.2h1.6a2.6 2.6 0 0 0 0-1.2 2.6 2.6 0 0 1 4.8 0 2.6 2.6 0 0 0 0 1.2h.6a2 2 0 0 0 1.8-2V4.3a2 2 0 0 0-1.8-2z" />
                <path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                <path d="M12 10v4" />
                <path d="M10 12h4" />
              </svg>
              <div>
                <div className={styles.cardTitle}>{t('bookingType.doctor')}</div>
                <div className={styles.cardSubtitle}>{t('bookingType.doctorDescription')}</div>
              </div>
            </div>
          </div>
          <svg className={styles.cardIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button
          className={`${styles.selectionCard} ${selectedType === 'mfa' ? styles.selected : ''}`}
          onClick={() => onSelect('mfa')}
        >
          <div className={styles.cardContent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M9 14l2 2 4-4" />
              </svg>
              <div>
                <div className={styles.cardTitle}>{t('bookingType.mfa')}</div>
                <div className={styles.cardSubtitle}>{t('bookingType.mfaDescription')}</div>
              </div>
            </div>
          </div>
          <svg className={styles.cardIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
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
