import { useState, useEffect, useMemo } from 'react';
import { DayView } from './DayView';
import { DayViewMulti } from './DayViewMulti';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { MiniCalendar } from './MiniCalendar';
import { useAppointments, useMfaAppointments, type AppointmentWithDetails } from '../../hooks';
import { supabase } from '../../../lib/supabaseClient';
import styles from './CalendarView.module.css';

type ViewType = 'day' | 'columns' | 'week' | 'month';
type FilterType = 'all' | 'doctor' | 'mfa';

interface Practitioner {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
}

interface CalendarViewProps {
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onNewAppointment?: () => void;
  lockedPractitionerId?: string | null;
}

export function CalendarView({ onAppointmentClick, onNewAppointment, lockedPractitionerId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('day');
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [filterPractitionerId, setFilterPractitionerId] = useState<string>('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const isLocked = !!lockedPractitionerId;

  // Wenn Arzt eingeloggt: Filter robust auf eigene ID locken — egal wann die Prop ankommt
  const effectivePractitionerId = lockedPractitionerId ?? filterPractitionerId;
  const effectiveFilterType: FilterType = lockedPractitionerId ? 'doctor' : filterType;

  const { appointments: doctorAppointments, loading: doctorLoading, error: doctorError, refetch: refetchDoctor } = useAppointments(currentDate, view);
  const { appointments: mfaAppointments, loading: mfaLoading, error: mfaError, refetch: refetchMfa } = useMfaAppointments(currentDate, view);

  const loading = doctorLoading || mfaLoading;
  const error = doctorError || mfaError;

  const refetch = () => {
    refetchDoctor();
    refetchMfa();
  };

  // Load practitioners for filter
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('practitioners')
        .select('id, title, first_name, last_name')
        .eq('is_active', true)
        .order('last_name');
      if (data) setPractitioners(data);
    }
    load();
  }, []);

  // Merge and filter appointments
  const filteredAppointments = useMemo(() => {
    let combined: AppointmentWithDetails[] = [];

    if (effectiveFilterType === 'all' || effectiveFilterType === 'doctor') {
      combined = [...doctorAppointments.map(a => ({ ...a, bookingType: 'doctor' as const }))];
    }
    if (effectiveFilterType === 'all' || effectiveFilterType === 'mfa') {
      combined = [...combined, ...mfaAppointments];
    }

    // Bei eingeloggtem Arzt: ausschließlich eigene Termine, MFA-Termine nicht zeigen
    if (lockedPractitionerId) {
      combined = combined.filter(apt =>
        apt.bookingType !== 'mfa' && apt.practitioner_id === lockedPractitionerId
      );
    } else if (effectivePractitionerId) {
      combined = combined.filter(apt =>
        apt.bookingType === 'mfa' || apt.practitioner_id === effectivePractitionerId
      );
    }

    return combined;
  }, [doctorAppointments, mfaAppointments, effectivePractitionerId, effectiveFilterType, lockedPractitionerId]);

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const newDate = new Date(currentDate);
    const offset = direction === 'prev' ? -1 : 1;

    if (view === 'day' || view === 'columns') {
      newDate.setDate(newDate.getDate() + offset);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + offset * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + offset);
    }

    setCurrentDate(newDate);
  };

  const formatDateHeader = () => {
    if (view === 'day' || view === 'columns') {
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

        <div className={styles.actions}>
          {!isLocked && (
            <>
              <select
                className={styles.filterSelect}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
              >
                <option value="all">Alle Termine</option>
                <option value="doctor">Arzttermine</option>
                <option value="mfa">MFA-Termine</option>
              </select>
              <select
                className={styles.filterSelect}
                value={filterPractitionerId}
                onChange={(e) => setFilterPractitionerId(e.target.value)}
              >
                <option value="">Alle Behandler</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title ? `${p.title} ` : ''}{p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </>
          )}
          {onNewAppointment && (
            <button onClick={onNewAppointment} className={styles.newButton}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Neuer Termin</span>
            </button>
          )}
          <div className={styles.viewSwitch}>
            <button
              className={`${styles.viewButton} ${view === 'day' ? styles.active : ''}`}
              onClick={() => setView('day')}
            >
              Tag
            </button>
            {!isLocked && (
              <button
                className={`${styles.viewButton} ${view === 'columns' ? styles.active : ''}`}
                onClick={() => setView('columns')}
                title="Pro Behandler (Spaltenansicht)"
              >
                Spalten
              </button>
            )}
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
        <div className={styles.body}>
          {(view === 'day' || view === 'columns') && (
            <MiniCalendar selectedDate={currentDate} onSelect={setCurrentDate} />
          )}
          <div className={styles.viewContainer}>
            {view === 'day' && (
              <DayView
                date={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={onAppointmentClick}
              />
            )}
            {view === 'columns' && (
              <DayViewMulti
                date={currentDate}
                appointments={filteredAppointments}
                practitioners={practitioners}
                onAppointmentClick={onAppointmentClick}
                showMfaColumn={filterType === 'all' || filterType === 'mfa'}
              />
            )}
            {view === 'week' && (
              <WeekView
                date={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={onAppointmentClick}
              />
            )}
            {view === 'month' && (
              <MonthView
                date={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={onAppointmentClick}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
