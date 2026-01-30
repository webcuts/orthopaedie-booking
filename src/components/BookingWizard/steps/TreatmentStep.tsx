import { useTreatmentTypes } from '../../../hooks/useSupabase';
import styles from '../BookingWizard.module.css';

interface TreatmentStepProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}

export function TreatmentStep({ selectedId, onSelect, onBack }: TreatmentStepProps) {
  const { data: treatmentTypes, loading, error, refetch } = useTreatmentTypes();

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Terminarten werden geladen...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorTitle}>Fehler beim Laden</div>
        <p>{error}</p>
        <button className={styles.retryButton} onClick={refetch}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Terminart wählen</h2>
        <p className={styles.stepDescription}>
          Welche Art von Termin benötigen Sie?
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
              <div className={styles.cardTitle}>{treatment.name}</div>
              <div className={styles.cardSubtitle}>
                {treatment.duration_minutes} Minuten
                {treatment.description && ` · ${treatment.description}`}
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
          Zurück
        </button>
      </div>
    </div>
  );
}
