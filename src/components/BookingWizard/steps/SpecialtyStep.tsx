import { useSpecialties } from '../../../hooks/useSupabase';
import styles from '../BookingWizard.module.css';

interface SpecialtyStepProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SpecialtyStep({ selectedId, onSelect }: SpecialtyStepProps) {
  const { data: specialties, loading, error, refetch } = useSpecialties();

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Fachgebiete werden geladen...</span>
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

  if (specialties.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Keine Fachgebiete verfügbar.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Fachgebiet wählen</h2>
        <p className={styles.stepDescription}>
          Welches Fachgebiet benötigen Sie?
        </p>
      </div>

      <div className={styles.selectionGrid}>
        {specialties.map((specialty) => (
          <button
            key={specialty.id}
            className={`${styles.selectionCard} ${selectedId === specialty.id ? styles.selected : ''}`}
            onClick={() => onSelect(specialty.id)}
          >
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>{specialty.name}</div>
            </div>
            <svg className={styles.cardIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
