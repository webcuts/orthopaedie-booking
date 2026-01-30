import { AppointmentCard } from '../Appointments/AppointmentCard';
import type { AppointmentWithDetails } from '../../hooks';
import styles from './WeekView.module.css';

interface WeekViewProps {
  date: Date;
  appointments: AppointmentWithDetails[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

export function WeekView({ date, appointments, onAppointmentClick }: WeekViewProps) {
  // Get week start (Monday)
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date().toISOString().split('T')[0];

  // Group appointments by day
  const appointmentsByDay = weekDays.map((d) => {
    const dateStr = d.toISOString().split('T')[0];
    return appointments.filter((apt) => apt.time_slot?.date === dateStr);
  });

  // Get appointment position based on time
  const getAppointmentStyle = (apt: AppointmentWithDetails) => {
    const [hours, minutes] = apt.time_slot.start_time.split(':').map(Number);
    const startMinutes = (hours - 7) * 60 + minutes;
    const duration = apt.treatment_type?.duration_minutes || 10;

    return {
      top: `${startMinutes}px`,
      height: `${Math.max(duration, 20)}px`,
    };
  };

  return (
    <div className={styles.weekView}>
      {/* Header with day names */}
      <div className={styles.header}>
        <div className={styles.timeHeader} />
        {weekDays.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0];
          const isToday = dateStr === today;
          return (
            <div
              key={i}
              className={`${styles.dayHeader} ${isToday ? styles.today : ''}`}
            >
              <span className={styles.weekday}>{WEEKDAYS[i]}</span>
              <span className={styles.dayNumber}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Grid body */}
      <div className={styles.body}>
        {/* Time column */}
        <div className={styles.timeColumn}>
          {HOURS.map((hour) => (
            <div key={hour} className={styles.timeSlot}>
              <span className={styles.time}>
                {hour.toString().padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((d, dayIndex) => {
          const dateStr = d.toISOString().split('T')[0];
          const isToday = dateStr === today;
          const dayApts = appointmentsByDay[dayIndex];

          return (
            <div
              key={dayIndex}
              className={`${styles.dayColumn} ${isToday ? styles.todayColumn : ''}`}
            >
              {/* Hour grid */}
              {HOURS.map((hour) => (
                <div key={hour} className={styles.hourCell} />
              ))}

              {/* Appointments */}
              <div className={styles.appointments}>
                {dayApts.map((apt) => (
                  <div
                    key={apt.id}
                    className={styles.appointmentWrapper}
                    style={getAppointmentStyle(apt)}
                  >
                    <AppointmentCard
                      appointment={apt}
                      onClick={() => onAppointmentClick(apt)}
                      compact
                      mini
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
