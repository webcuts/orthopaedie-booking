import { usePractitioners } from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import styles from '../BookingWizard.module.css';

interface PractitionerStepProps {
  specialtyId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onBack: () => void;
}

export function PractitionerStep({ specialtyId, selectedId, onSelect, onBack }: PractitionerStepProps) {
  const { data: practitioners, loading, error } = usePractitioners(specialtyId);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Behandler werden geladen...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorTitle}>Fehler beim Laden</div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Behandler wählen</h2>
        <p className={styles.stepDescription}>
          Bei welchem Behandler möchten Sie einen Termin?
        </p>
      </div>

      <div className={styles.selectionGrid}>
        {/* Option: Keine Präferenz */}
        <button
          className={`${styles.selectionCard} ${selectedId === null ? styles.selected : ''}`}
          onClick={() => onSelect(null)}
        >
          <div className={styles.cardContent}>
            <div className={styles.cardTitle}>Ich habe keine Präferenz</div>
            <div className={styles.cardSubtitle}>Nächster verfügbarer Behandler</div>
          </div>
          <svg className={styles.cardIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Behandler-Liste */}
        {practitioners.map((practitioner) => (
          <button
            key={practitioner.id}
            className={`${styles.selectionCard} ${selectedId === practitioner.id ? styles.selected : ''}`}
            onClick={() => onSelect(practitioner.id)}
          >
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>
                {getPractitionerFullName(practitioner)}
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
