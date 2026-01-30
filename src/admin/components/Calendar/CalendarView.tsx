import { useState } from 'react';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { useAppointments, type AppointmentWithDetails } from '../../hooks';
import styles from './CalendarView.module.css';

type ViewType = 'day' | 'week' | 'month';

interface CalendarViewProps {
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
}

export function CalendarView({ onAppointmentClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('day');

  const { appointments, loading, error, refetch } = useAppointments(currentDate, view);

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const newDate = new Date(currentDate);
    const offset = direction === 'prev' ? -1 : 1;

    if (view === 'day') {
      newDate.setDate(newDate.getDate() + offset);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + offset * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + offset);
    }

    setCurrentDate(newDate);
  };

  const formatDateHeader = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } else if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      return `${startOfWeek.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      });
    }
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.toolbar}>
        <div className={styles.navigation}>
          <button onClick={() => navigateDate('prev')} className={styles.navButton}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button onClick={() => navigateDate('today')} className={styles.todayButton}>
            Heute
          </button>
          <button onClick={() => navigateDate('next')} className={styles.navButton}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <h2 className={styles.dateHeader}>{formatDateHeader()}</h2>

        <div className={styles.viewSwitch}>
          <button
            className={`${styles.viewButton} ${view === 'day' ? styles.active : ''}`}
            onClick={() => setView('day')}
          >
            Tag
          </button>
          <button
            className={`${styles.viewButton} ${view === 'week' ? styles.active : ''}`}
            onClick={() => setView('week')}
          >
            Woche
          </button>
          <button
            className={`${styles.viewButton} ${view === 'month' ? styles.active : ''}`}
            onClick={() => setView('month')}
          >
            Monat
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={refetch}>Erneut versuchen</button>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Lade Termine...</div>
      ) : (
        <div className={styles.viewContainer}>
          {view === 'day' && (
            <DayView
              date={currentDate}
              appointments={appointments}
              onAppointmentClick={onAppointmentClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              date={currentDate}
              appointments={appointments}
              onAppointmentClick={onAppointmentClick}
            />
          )}
          {view === 'month' && (
            <MonthView
              date={currentDate}
              appointments={appointments}
              onAppointmentClick={onAppointmentClick}
            />
          )}
        </div>
      )}
    </div>
  );
}
