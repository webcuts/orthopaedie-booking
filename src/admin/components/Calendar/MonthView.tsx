import type { AppointmentWithDetails } from '../../hooks';
import styles from './MonthView.module.css';

interface MonthViewProps {
  date: Date;
  appointments: AppointmentWithDetails[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#22C55E',
  cancelled: '#DC3545',
  completed: '#6B7280',
};

function getBorderColor(apt: AppointmentWithDetails): string {
  if (apt.bookingType === 'mfa') return '#7C3AED';
  return STATUS_COLORS[apt.status] || '#6B7280';
}

export function MonthView({ date, appointments, onAppointmentClick }: MonthViewProps) {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Get first day of month and adjust to Monday start
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const startOffset = startDay === 0 ? 6 : startDay - 1;

  // Get last day of month
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Calculate total cells needed (full weeks)
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  // Generate calendar cells
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNumber = i - startOffset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null;
    }
    return new Date(year, month, dayNumber);
  });

  const today = new Date().toISOString().split('T')[0];

  // Group appointments by date
  const appointmentsByDate: Record<string, AppointmentWithDetails[]> = {};
  appointments.forEach((apt) => {
    const dateStr = apt.time_slot?.date;
    if (dateStr) {
      if (!appointmentsByDate[dateStr]) {
        appointmentsByDate[dateStr] = [];
      }
      appointmentsByDate[dateStr].push(apt);
    }
  });

  return (
    <div className={styles.monthView}>
      {/* Weekday headers */}
      <div className={styles.header}>
        {WEEKDAYS.map((day) => (
          <div key={day} className={styles.weekday}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={styles.grid}>
        {cells.map((cellDate, i) => {
          if (!cellDate) {
            return <div key={i} className={styles.emptyCell} />;
          }

          const dateStr = cellDate.toISOString().split('T')[0];
          const isToday = dateStr === today;
          const dayApts = appointmentsByDate[dateStr] || [];

          return (
            <div
              key={i}
              className={`${styles.cell} ${isToday ? styles.today : ''}`}
            >
              <span className={styles.dayNumber}>{cellDate.getDate()}</span>

              <div className={styles.appointments}>
                {dayApts.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    className={styles.appointment}
                    style={{ borderLeftColor: getBorderColor(apt) }}
                    onClick={() => onAppointmentClick(apt)}
                    title={`${apt.time_slot.start_time} - ${apt.patient?.name}`}
                  >
                    <span className={styles.time}>{apt.time_slot.start_time.slice(0, 5)}</span>
                    <span className={styles.name}>{apt.patient?.name}</span>
                  </div>
                ))}
                {dayApts.length > 3 && (
                  <div className={styles.more}>
                    +{dayApts.length - 3} weitere
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
