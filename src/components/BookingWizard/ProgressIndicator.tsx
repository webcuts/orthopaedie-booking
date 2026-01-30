import styles from './ProgressIndicator.module.css';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_LABELS = [
  'Fachgebiet',
  'Versicherung',
  'Terminart',
  'Behandler',
  'Datum',
  'Uhrzeit',
  'Kontakt'
];

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
      </div>
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
            <span className={styles.stepLabel}>{STEP_LABELS[step - 1]}</span>
          </div>
        ))}
      </div>
      <div className={styles.mobileIndicator}>
        Schritt {currentStep} von {totalSteps}: {STEP_LABELS[currentStep - 1]}
      </div>
    </div>
  );
}
