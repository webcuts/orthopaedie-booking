import type { AppointmentWithDetails } from '../../hooks';
import styles from './DayViewMulti.module.css';

interface Practitioner {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
}

interface DayViewMultiProps {
  date: Date;
  appointments: AppointmentWithDetails[];
  practitioners: Practitioner[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  showMfaColumn?: boolean;
}

const START_HOUR = 7;
const END_HOUR = 18;
const SLOT_HEIGHT = 48;
const MINUTES_PER_SLOT = 15;
const PIXELS_PER_MINUTE = SLOT_HEIGHT / MINUTES_PER_SLOT;

const TIME_SLOTS = Array.from(
  { length: (END_HOUR - START_HOUR) * 4 + 1 },
  (_, i) => {
    const totalMinutes = START_HOUR * 60 + i * MINUTES_PER_SLOT;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      isHour: minutes === 0,
    };
  }
);

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  confirmed: { bg: '#D1FAE5', border: '#22C55E', text: '#166534' },
  cancelled: { bg: '#FEE2E2', border: '#DC3545', text: '#991B1B' },
  completed: { bg: '#F3F4F6', border: '#6B7280', text: '#374151' },
};

const MFA_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: '#F3E8FF', border: '#7C3AED', text: '#5B21B6' },
  confirmed: { bg: '#EDE9FE', border: '#7C3AED', text: '#5B21B6' },
  cancelled: { bg: '#FEE2E2', border: '#DC3545', text: '#991B1B' },
  completed: { bg: '#F5F3FF', border: '#8B5CF6', text: '#6D28D9' },
};

function getColors(apt: AppointmentWithDetails) {
  const palette = apt.bookingType === 'mfa' ? MFA_COLORS : STATUS_COLORS;
  return palette[apt.status] || STATUS_COLORS.pending;
}

function getStyle(apt: AppointmentWithDetails): React.CSSProperties {
  const [hours, minutes] = apt.time_slot.start_time.split(':').map(Number);
  const startMinutes = (hours - START_HOUR) * 60 + minutes;
  const duration = apt.treatment_type?.duration_minutes || 10;
  return {
    top: `${startMinutes * PIXELS_PER_MINUTE}px`,
    height: `${Math.max(duration * PIXELS_PER_MINUTE, 32)}px`,
  };
}

function formatTime(timeStr: string) {
  return timeStr?.slice(0, 5);
}

export function DayViewMulti({
  date,
  appointments,
  practitioners,
  onAppointmentClick,
  showMfaColumn = true,
}: DayViewMultiProps) {
  const dateStr = date.toISOString().split('T')[0];
  const dayAppts = appointments.filter(
    (apt) => apt.time_slot?.date === dateStr && apt.status !== 'cancelled'
  );

  const byPractitioner = new Map<string, AppointmentWithDetails[]>();
  const mfaAppts: AppointmentWithDetails[] = [];

  for (const apt of dayAppts) {
    if (apt.bookingType === 'mfa') {
      mfaAppts.push(apt);
      continue;
    }
    if (apt.practitioner_id) {
      const list = byPractitioner.get(apt.practitioner_id) ?? [];
      list.push(apt);
      byPractitioner.set(apt.practitioner_id, list);
    }
  }

  return (
    <div className={styles.dayView}>
      <div className={styles.timeColumn}>
        <div className={styles.timeColumnHeader} />
        {TIME_SLOTS.map((slot) => (
          <div
            key={slot.time}
            className={`${styles.timeSlot} ${slot.isHour ? styles.isHour : ''}`}
          >
            {slot.isHour && <span className={styles.time}>{slot.time}</span>}
          </div>
        ))}
      </div>

      <div className={styles.columns}>
        {practitioners.map((p) => {
          const list = byPractitioner.get(p.id) ?? [];
          const label = `${p.title ? p.title + ' ' : ''}${p.last_name}`;
          return (
            <PractitionerColumn
              key={p.id}
              label={label}
              appointments={list}
              onClick={onAppointmentClick}
            />
          );
        })}
        {showMfaColumn && mfaAppts.length > 0 && (
          <PractitionerColumn
            label="MFA"
            mfa
            appointments={mfaAppts}
            onClick={onAppointmentClick}
          />
        )}
      </div>
    </div>
  );
}

interface PractitionerColumnProps {
  label: string;
  appointments: AppointmentWithDetails[];
  onClick: (apt: AppointmentWithDetails) => void;
  mfa?: boolean;
}

function PractitionerColumn({ label, appointments, onClick, mfa = false }: PractitionerColumnProps) {
  return (
    <div className={styles.column}>
      <div className={`${styles.columnHeader} ${mfa ? styles.mfa : ''}`}>
        {label}
      </div>
      <div className={styles.columnBody}>
        <div className={styles.grid}>
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot.time}
              className={`${styles.gridRow} ${slot.isHour ? styles.hourBorder : ''}`}
            />
          ))}
        </div>
        <CurrentTimeIndicator />
        {appointments.map((apt) => {
          const colors = getColors(apt);
          return (
            <div
              key={apt.id}
              className={styles.appointmentWrapper}
              style={{
                ...getStyle(apt),
                backgroundColor: colors.bg,
                borderLeftColor: colors.border,
              }}
              onClick={() => onClick(apt)}
            >
              <div className={styles.appointmentContent}>
                <span className={styles.appointmentTime}>{formatTime(apt.time_slot?.start_time)}</span>
                <span className={styles.appointmentPatient} style={{ color: colors.text }}>
                  {apt.patient?.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours < START_HOUR || hours >= END_HOUR) return null;
  const top = ((hours - START_HOUR) * 60 + minutes) * PIXELS_PER_MINUTE;
  return (
    <div className={styles.currentTime} style={{ top: `${top}px` }}>
      <div className={styles.currentTimeLine} />
    </div>
  );
}
