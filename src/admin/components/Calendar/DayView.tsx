import type { AppointmentWithDetails } from '../../hooks';
import styles from './DayView.module.css';

interface DayViewProps {
  date: Date;
  appointments: AppointmentWithDetails[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
}

// Zeitkonstanten
const START_HOUR = 7;
const END_HOUR = 18;
const SLOT_HEIGHT = 20; // Pixel pro 15 Minuten
const MINUTES_PER_SLOT = 15;

// Generiere 15-Minuten-Slots von 07:00 bis 18:00
const TIME_SLOTS = Array.from(
  { length: (END_HOUR - START_HOUR) * 4 + 1 },
  (_, i) => {
    const totalMinutes = START_HOUR * 60 + i * MINUTES_PER_SLOT;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      isHour: minutes === 0,
      isHalfHour: minutes === 30,
    };
  }
);

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  confirmed: { bg: '#D1FAE5', border: '#22C55E', text: '#166534' },
  cancelled: { bg: '#FEE2E2', border: '#DC3545', text: '#991B1B' },
  completed: { bg: '#F3F4F6', border: '#6B7280', text: '#374151' },
};

export function DayView({ date, appointments, onAppointmentClick }: DayViewProps) {
  const dateStr = date.toISOString().split('T')[0];

  // Filter appointments for this day (exclude cancelled)
  const dayAppointments = appointments.filter(
    (apt) => apt.time_slot?.date === dateStr && apt.status !== 'cancelled'
  );

  // Get appointment position and height based on time
  const getAppointmentStyle = (apt: AppointmentWithDetails) => {
    const [hours, minutes] = apt.time_slot.start_time.split(':').map(Number);
    const startMinutes = (hours - START_HOUR) * 60 + minutes;
    const duration = apt.treatment_type?.duration_minutes || 15;

    // Berechne Position: Pixel pro Minute = SLOT_HEIGHT / MINUTES_PER_SLOT
    const pixelsPerMinute = SLOT_HEIGHT / MINUTES_PER_SLOT;
    const top = startMinutes * pixelsPerMinute;
    const height = Math.max(duration * pixelsPerMinute, SLOT_HEIGHT); // Mindesthöhe

    return { top: `${top}px`, height: `${height}px` };
  };

  const formatTime = (timeStr: string) => timeStr?.slice(0, 5);

  return (
    <div className={styles.dayView}>
      {/* Zeitspalte */}
      <div className={styles.timeColumn}>
        {TIME_SLOTS.map((slot) => (
          <div
            key={slot.time}
            className={`${styles.timeSlot} ${slot.isHour ? styles.isHour : ''} ${slot.isHalfHour ? styles.isHalfHour : ''}`}
          >
            {(slot.isHour || slot.isHalfHour) && (
              <span className={styles.time}>{slot.time}</span>
            )}
          </div>
        ))}
      </div>

      {/* Termine-Spalte */}
      <div className={styles.appointmentsColumn}>
        {/* Hintergrund-Grid */}
        <div className={styles.grid}>
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot.time}
              className={`${styles.gridRow} ${slot.isHour ? styles.hourBorder : ''}`}
            />
          ))}
        </div>

        {/* Aktuelle Zeit-Indikator */}
        <CurrentTimeIndicator />

        {/* Termine */}
        <div className={styles.appointments}>
          {dayAppointments.map((apt) => {
            const colors = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
            return (
              <div
                key={apt.id}
                className={styles.appointmentWrapper}
                style={{
                  ...getAppointmentStyle(apt),
                  backgroundColor: colors.bg,
                  borderLeftColor: colors.border,
                }}
                onClick={() => onAppointmentClick(apt)}
              >
                <div className={styles.appointmentContent}>
                  <div className={styles.appointmentHeader}>
                    <span className={styles.appointmentTime}>
                      {formatTime(apt.time_slot?.start_time)} - {formatTime(apt.time_slot?.end_time)}
                    </span>
                    <span className={styles.appointmentDuration}>
                      {apt.treatment_type?.duration_minutes} Min
                    </span>
                  </div>
                  <div className={styles.appointmentPatient} style={{ color: colors.text }}>
                    {apt.patient?.name}
                  </div>
                  <div className={styles.appointmentTreatment}>
                    {apt.treatment_type?.name}
                  </div>
                  {apt.practitioner && (
                    <div className={styles.appointmentPractitioner}>
                      {apt.practitioner.title} {apt.practitioner.first_name} {apt.practitioner.last_name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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

// Aktuelle Zeit-Indikator Komponente
function CurrentTimeIndicator() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Nur anzeigen wenn innerhalb der Arbeitszeit
  if (hours < START_HOUR || hours >= END_HOUR) return null;

  const pixelsPerMinute = SLOT_HEIGHT / MINUTES_PER_SLOT;
  const top = ((hours - START_HOUR) * 60 + minutes) * pixelsPerMinute;

  return (
    <div className={styles.currentTime} style={{ top: `${top}px` }}>
      <div className={styles.currentTimeDot} />
      <div className={styles.currentTimeLine} />
    </div>
  );
}
