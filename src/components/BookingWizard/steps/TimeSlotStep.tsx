import { useTimeSlots } from '../../../hooks/useSupabase';
import styles from '../BookingWizard.module.css';
import timeStyles from './TimeSlotStep.module.css';

interface TimeSlotStepProps {
  selectedDate: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}

export function TimeSlotStep({ selectedDate, selectedId, onSelect, onBack }: TimeSlotStepProps) {
  const { data: timeSlots, loading, error } = useTimeSlots(selectedDate);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Verfügbare Uhrzeiten werden geladen...</span>
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
        <h2 className={styles.stepTitle}>Uhrzeit wählen</h2>
        <p className={styles.stepDescription}>
          {selectedDate && formatDate(selectedDate)}
        </p>
      </div>

      {timeSlots.length === 0 ? (
        <div className={timeStyles.noSlots}>
          <p>Für diesen Tag sind leider keine Termine mehr verfügbar.</p>
          <button
            className={styles.backButton}
            onClick={onBack}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Anderen Tag wählen
          </button>
        </div>
      ) : (
        <div className={timeStyles.grid}>
          {timeSlots.map((slot) => (
            <button
              key={slot.id}
              className={`${timeStyles.slot} ${selectedId === slot.id ? timeStyles.selected : ''}`}
              onClick={() => onSelect(slot.id)}
            >
              {formatTime(slot.start_time)}
            </button>
          ))}
        </div>
      )}

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
