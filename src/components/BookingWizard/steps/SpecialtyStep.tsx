import { useMemo } from 'react';
import { useSpecialties, useNextFreeSlot } from '../../../hooks/useSupabase';
import { useTranslation, getLocalizedName } from '../../../i18n';
import styles from '../BookingWizard.module.css';

interface SpecialtyStepProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR',
};

export function SpecialtyStep({ selectedId, onSelect }: SpecialtyStepProps) {
  const { data: specialties, loading, error, refetch } = useSpecialties();
  const { date: nextDate, startTime: nextTime, loading: nextLoading } = useNextFreeSlot();
  const { t, language } = useTranslation();

  const nextSlotText = useMemo(() => {
    if (nextLoading || !nextDate || !nextTime) return null;

    const time = nextTime.slice(0, 5);
    const now = new Date();
    const slotDate = new Date(nextDate + 'T00:00:00');
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (slotDate.getTime() === today.getTime()) {
      return t('nextFreeSlot.today').replace('{time}', time);
    }
    if (slotDate.getTime() === tomorrow.getTime()) {
      return t('nextFreeSlot.tomorrow').replace('{time}', time);
    }

    const locale = localeMap[language] || 'de-DE';
    const formatted = slotDate.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
    return t('nextFreeSlot.date').replace('{date}', formatted).replace('{time}', time);
  }, [nextDate, nextTime, nextLoading, language, t]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>{t('specialty.loading')}</span>
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

  if (specialties.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>{t('specialty.empty')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('specialty.title')}</h2>
        <p className={styles.stepDescription}>
          {t('specialty.description')}
        </p>
      </div>

      {nextSlotText && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          marginBottom: '16px',
          background: '#F0FDF4',
          borderRadius: '8px',
          border: '1px solid #BBF7D0',
          fontSize: '0.875rem',
          color: '#15803D',
          fontWeight: 500,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {nextSlotText}
        </div>
      )}

      <div className={styles.selectionGrid}>
        {specialties.map((specialty) => (
          <button
            key={specialty.id}
            className={`${styles.selectionCard} ${selectedId === specialty.id ? styles.selected : ''}`}
            onClick={() => onSelect(specialty.id)}
          >
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>{getLocalizedName(specialty, language)}</div>
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
