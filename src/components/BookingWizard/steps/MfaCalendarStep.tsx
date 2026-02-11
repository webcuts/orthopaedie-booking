import { useState, useMemo } from 'react';
import { useMfaAvailableDates, useMfaTimeSlots, usePracticeHours } from '../../../hooks/useSupabase';
import { useTranslation, useTranslationArray } from '../../../i18n';
import styles from '../BookingWizard.module.css';
import calStyles from './MfaCalendarStep.module.css';

interface MfaCalendarStepProps {
  selectedDate: string | null;
  selectedTimeSlotId: string | null;
  onSelect: (date: string, slotId: string, startTime: string) => void;
  onBack: () => void;
}

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR'
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function MfaCalendarStep({ selectedDate, selectedTimeSlotId, onSelect, onBack }: MfaCalendarStepProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [pickedDate, setPickedDate] = useState<string | null>(selectedDate);
  const { data: availableDates, loading } = useMfaAvailableDates(currentMonth);
  const { data: practiceHours } = usePracticeHours();
  const { data: timeSlots, loading: timeSlotsLoading } = useMfaTimeSlots(pickedDate);
  const { t, language } = useTranslation();
  const weekdays = useTranslationArray('date.weekdays');

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

    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));

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
    if (date < today) return false;
    const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
    if (closedDays.includes(dayOfWeek)) return false;
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

  // Filter past slots for today (30 min buffer)
  const filteredSlots = useMemo(() => {
    if (!pickedDate || !timeSlots.length) return timeSlots;
    const now = new Date();
    const selected = new Date(pickedDate + 'T00:00:00');
    const isToday = now.toDateString() === selected.toDateString();
    if (!isToday) return timeSlots;

    const cutoff = new Date(now.getTime() + 30 * 60 * 1000);
    const cutoffTime = cutoff.toTimeString().slice(0, 5);
    return timeSlots.filter(slot => slot.start_time.slice(0, 5) > cutoffTime);
  }, [timeSlots, pickedDate]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('mfaCalendar.title')}</h2>
        <p className={styles.stepDescription}>
          {t('mfaCalendar.description')}
        </p>
      </div>

      {/* Calendar */}
      <div className={calStyles.calendar}>
        <div className={calStyles.header}>
          <button
            className={calStyles.navButton}
            onClick={prevMonth}
            disabled={!canGoPrev}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className={calStyles.monthLabel}>{formatMonth(currentMonth)}</span>
          <button className={calStyles.navButton} onClick={nextMonth}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className={calStyles.weekdays}>
          {weekdays.map(day => (
            <div key={day} className={calStyles.weekday}>{day}</div>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : (
          <div className={calStyles.days}>
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className={calStyles.emptyDay} />;
              }

              const dateStr = formatLocalDate(date);
              const isSelected = pickedDate === dateStr;
              const isSelectable = isDateSelectable(date);
              const isToday = date.getTime() === today.getTime();

              return (
                <button
                  key={dateStr}
                  className={`${calStyles.day} ${isSelected ? calStyles.selected : ''} ${!isSelectable ? calStyles.disabled : ''} ${isToday ? calStyles.today : ''}`}
                  onClick={() => isSelectable && setPickedDate(dateStr)}
                  disabled={!isSelectable}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Time Slots */}
      {pickedDate && (
        <div className={calStyles.timeSection}>
          <div className={calStyles.timeSectionTitle}>
            {formatDate(pickedDate)}
          </div>

          {timeSlotsLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          ) : filteredSlots.filter(s => s.available).length === 0 ? (
            <div className={calStyles.noTimeSlots}>
              <p>{t('mfaCalendar.noSlots')}</p>
            </div>
          ) : (
            <div className={calStyles.timeGrid}>
              {filteredSlots.filter(s => s.available).map((slot) => (
                <button
                  key={slot.id}
                  className={`${calStyles.timeSlot} ${selectedTimeSlotId === slot.id ? calStyles.selected : ''}`}
                  onClick={() => onSelect(pickedDate, slot.id, slot.start_time)}
                >
                  {slot.start_time.substring(0, 5)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && availableDates.length === 0 && (
        <div className={calStyles.noSlots}>
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
