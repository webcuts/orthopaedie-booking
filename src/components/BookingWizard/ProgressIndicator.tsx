import { useTranslation } from '../../i18n';
import styles from './ProgressIndicator.module.css';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_KEYS = [
  'step.specialty',
  'step.insurance',
  'step.treatment',
  'step.practitioner',
  'step.date',
  'step.time',
  'step.contact'
];

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      {/* Fortschrittsbalken */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
      </div>

      {/* Desktop: Alle Schritte */}
      <div className={styles.steps}>
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`${styles.step} ${step === currentStep ? styles.active : ''} ${step < currentStep ? styles.completed : ''}`}
          >
            <div className={styles.stepNumber}>
              {step < currentStep ? (
                <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step
              )}
            </div>
            <span className={styles.stepLabel}>{t(STEP_KEYS[step - 1])}</span>
          </div>
        ))}
      </div>

      {/* Mobile: Kompakte Anzeige */}
      <div className={styles.mobileIndicator}>
        <span className={styles.mobileStep}>
          {t('stepIndicator', { current: currentStep, total: totalSteps })}
        </span>
        <span className={styles.mobileDivider}>|</span>
        <span className={styles.mobileLabel}>
          {t(STEP_KEYS[currentStep - 1])}
        </span>
      </div>
    </div>
  );
}
