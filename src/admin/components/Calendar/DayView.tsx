import { AppointmentCard } from '../Appointments/AppointmentCard';
import type { AppointmentWithDetails } from '../../hooks';
import styles from './DayView.module.css';

interface DayViewProps {
  date: Date;
  appointments: AppointmentWithDetails[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
}

// Generate time slots from 7:00 to 18:00
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

export function DayView({ date, appointments, onAppointmentClick }: DayViewProps) {
  const dateStr = date.toISOString().split('T')[0];

  // Filter appointments for this day
  const dayAppointments = appointments.filter(
    (apt) => apt.time_slot?.date === dateStr
  );

  // Get appointment position based on time
  const getAppointmentStyle = (apt: AppointmentWithDetails) => {
    const [hours, minutes] = apt.time_slot.start_time.split(':').map(Number);
    const startMinutes = (hours - 7) * 60 + minutes;
    const duration = apt.treatment_type?.duration_minutes || 10;

    return {
      top: `${startMinutes}px`,
      height: `${duration}px`,
    };
  };

  return (
    <div className={styles.dayView}>
      <div className={styles.timeColumn}>
        {HOURS.map((hour) => (
          <div key={hour} className={styles.timeSlot}>
            <span className={styles.time}>
              {hour.toString().padStart(2, '0')}:00
            </span>
          </div>
        ))}
      </div>

      <div className={styles.appointmentsColumn}>
        <div className={styles.grid}>
          {HOURS.map((hour) => (
            <div key={hour} className={styles.hourRow} />
          ))}
        </div>

        <div className={styles.appointments}>
          {dayAppointments.map((apt) => (
            <div
              key={apt.id}
              className={styles.appointmentWrapper}
              style={getAppointmentStyle(apt)}
            >
              <AppointmentCard
                appointment={apt}
                onClick={() => onAppointmentClick(apt)}
                compact
              />
            </div>
          ))}
        </div>

        {dayAppointments.length === 0 && (
          <div className={styles.empty}>
            Keine Termine an diesem Tag
          </div>
        )}
      </div>
    </div>
  );
}
