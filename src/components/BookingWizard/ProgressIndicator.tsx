import { useTranslation } from '../../i18n';
import { STEP_LABEL_KEYS } from './BookingWizard';
import type { StepType } from './BookingWizard';
import styles from './ProgressIndicator.module.css';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: StepType[];
}

export function ProgressIndicator({ currentStep, totalSteps, steps }: ProgressIndicatorProps) {
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
        {steps.map((stepType, i) => {
          const step = i + 1;
          return (
            <div
              key={stepType}
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
              <span className={styles.stepLabel}>{t(STEP_LABEL_KEYS[stepType])}</span>
            </div>
          );
        })}
      </div>

      {/* Mobile: Kompakte Anzeige */}
      <div className={styles.mobileIndicator}>
        <span className={styles.mobileStep}>
          {t('stepIndicator', { current: currentStep, total: totalSteps })}
        </span>
        <span className={styles.mobileDivider}>|</span>
        <span className={styles.mobileLabel}>
          {t(STEP_LABEL_KEYS[steps[currentStep - 1]])}
        </span>
      </div>
    </div>
  );
}
