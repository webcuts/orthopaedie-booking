import { useState, useMemo } from 'react';
import { useAvailableDates, usePracticeHours, useNextFreeSlot } from '../../../hooks/useSupabase';
import { useTranslation, useTranslationArray } from '../../../i18n';
import styles from '../BookingWizard.module.css';
import dateStyles from './DateStep.module.css';

interface DateStepProps {
  selectedDate: string | null;
  practitionerId: string | null;
  onSelect: (date: string) => void;
  onBack: () => void;
}

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR'
};

/**
 * Formatiert ein Date-Objekt als YYYY-MM-DD String
 * OHNE Timezone-Konvertierung (verwendet lokale Zeit)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateStep({ selectedDate, practitionerId, onSelect, onBack }: DateStepProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const { data: availableDates, loading, error } = useAvailableDates(currentMonth, practitionerId);
  const { data: practiceHours } = usePracticeHours();
  const { date: nextDate, startTime: nextTime, loading: nextLoading } = useNextFreeSlot();
  const { t, language } = useTranslation();
  const weekdays = useTranslationArray('date.weekdays');

  const nextSlotText = useMemo(() => {
    if (nextLoading || !nextDate || !nextTime) return null;

    const time = nextTime.slice(0, 5);
    const now = new Date();
    const slotDate = new Date(nextDate + 'T00:00:00');
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(todayDate.getDate() + 1);

    if (slotDate.getTime() === todayDate.getTime()) {
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

  const closedDays = useMemo(() => {
    return practiceHours
      .filter(h => h.is_closed)
      .map(h => h.day_of_week);
  }, [practiceHours]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Adjust for Monday start (0 = Monday in our system)
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentMonth]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isDateAvailable = (date: Date) => {
    const dateStr = formatLocalDate(date);
    return availableDates.includes(dateStr);
  };

  const isDateSelectable = (date: Date) => {
    // Past dates
    if (date < today) return false;

    // Closed days (Sunday = 6 in our system, but Date.getDay() returns 0 for Sunday)
    const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
    if (closedDays.includes(dayOfWeek)) return false;

    // No available slots
    if (!isDateAvailable(date)) return false;

    return true;
  };

  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const canGoPrev = useMemo(() => {
    const prevMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return prevMonthDate >= thisMonth;
  }, [currentMonth, today]);

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString(localeMap[language] || 'de-DE', { month: 'long', year: 'numeric' });
  };

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('date.title')}</h2>
        <p className={styles.stepDescription}>
          {t('date.description')}
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {nextSlotText}
        </div>
      )}

      <div className={dateStyles.calendar}>
        <div className={dateStyles.header}>
          <button
            className={dateStyles.navButton}
            onClick={prevMonth}
            disabled={!canGoPrev}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className={dateStyles.monthLabel}>{formatMonth(currentMonth)}</span>
          <button className={dateStyles.navButton} onClick={nextMonth}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className={dateStyles.weekdays}>
          {weekdays.map(day => (
            <div key={day} className={dateStyles.weekday}>{day}</div>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : (
          <div className={dateStyles.days}>
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className={dateStyles.emptyDay} />;
              }

              const dateStr = formatLocalDate(date);
              const isSelected = selectedDate === dateStr;
              const isSelectable = isDateSelectable(date);
              const isToday = date.getTime() === today.getTime();

              return (
                <button
                  key={dateStr}
                  className={`${dateStyles.day} ${isSelected ? dateStyles.selected : ''} ${!isSelectable ? dateStyles.disabled : ''} ${isToday ? dateStyles.today : ''}`}
                  onClick={() => isSelectable && onSelect(dateStr)}
                  disabled={!isSelectable}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {!loading && availableDates.length === 0 && (
        <div className={dateStyles.noSlots}>
          <p>{t('date.noSlots')}</p>
          <p>{t('date.noSlotsHint')}</p>
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
