import { useState, useMemo, useEffect } from 'react';
import { formatLocalDate } from '../../../utils/dates';
import styles from './MiniCalendar.module.css';

interface MiniCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function MiniCalendar({ selectedDate, onSelect }: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  // Wenn selectedDate von außen in einen anderen Monat springt: Mini-Kalender mitziehen
  useEffect(() => {
    const sameMonth =
      viewMonth.getFullYear() === selectedDate.getFullYear() &&
      viewMonth.getMonth() === selectedDate.getMonth();
    if (!sameMonth) {
      setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [selectedDate, viewMonth]);

  const todayStr = formatLocalDate(new Date());
  const selectedStr = formatLocalDate(selectedDate);

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const startOffset = startDay === 0 ? 6 : startDay - 1; // Mo-first
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNumber = i - startOffset + 1;
      if (dayNumber < 1 || dayNumber > lastDay.getDate()) return null;
      return new Date(year, month, dayNumber);
    });
  }, [viewMonth]);

  const prevMonth = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelect(now);
  };

  const monthLabel = `${MONTHS[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

  return (
    <div className={styles.mini}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={prevMonth}
          aria-label="Voriger Monat"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button
          type="button"
          className={styles.navBtn}
          onClick={nextMonth}
          aria-label="Nächster Monat"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className={styles.weekdayRow}>
        {WEEKDAYS.map((d) => (
          <div key={d} className={styles.weekday}>{d}</div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((cellDate, i) => {
          if (!cellDate) {
            return <div key={i} className={styles.empty} />;
          }
          const dateStr = formatLocalDate(cellDate);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedStr;
          const dow = cellDate.getDay();
          const isWeekend = dow === 0 || dow === 6;

          const classes = [
            styles.day,
            isWeekend ? styles.weekend : '',
            isToday ? styles.today : '',
            isSelected ? styles.selected : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={i}
              type="button"
              className={classes}
              onClick={() => onSelect(cellDate)}
            >
              {cellDate.getDate()}
            </button>
          );
        })}
      </div>

      <button type="button" className={styles.todayBtn} onClick={goToday}>
        Heute
      </button>
    </div>
  );
}
