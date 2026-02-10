import { useTimeSlots } from '../../../hooks/useSupabase';
import { useTranslation } from '../../../i18n';
import styles from '../BookingWizard.module.css';
import timeStyles from './TimeSlotStep.module.css';

interface TimeSlotStepProps {
  selectedDate: string | null;
  selectedId: string | null;
  practitionerId: string | null;
  onSelect: (id: string, startTime: string) => void;
  onBack: () => void;
}

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR'
};

export function TimeSlotStep({ selectedDate, selectedId, practitionerId, onSelect, onBack }: TimeSlotStepProps) {
  const { data: timeSlots, loading, error } = useTimeSlots(selectedDate, practitionerId);
  const { t, language } = useTranslation();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
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
        <span>{t('time.loading')}</span>
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
        <h2 className={styles.stepTitle}>{t('time.title')}</h2>
        <p className={styles.stepDescription}>
          {selectedDate && formatDate(selectedDate)}
        </p>
      </div>

      {timeSlots.length === 0 ? (
        <div className={timeStyles.noSlots}>
          <p>{t('time.noSlots')}</p>
          <button
            className={styles.backButton}
            onClick={onBack}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            {t('time.chooseOtherDay')}
          </button>
        </div>
      ) : (
        <div className={timeStyles.grid}>
          {timeSlots.map((slot) => (
            <button
              key={slot.id}
              className={`${timeStyles.slot} ${selectedId === slot.id ? timeStyles.selected : ''}`}
              onClick={() => onSelect(slot.id, slot.start_time)}
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
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
