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
const SLOT_HEIGHT = 48; // Pixel pro 15 Minuten (vorher 20)
const MINUTES_PER_SLOT = 15;
const PIXELS_PER_MINUTE = SLOT_HEIGHT / MINUTES_PER_SLOT;

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

interface LayoutInfo {
  column: number;
  totalColumns: number;
}

/**
 * Berechnet Spalten für überlappende Termine,
 * damit sie nebeneinander dargestellt werden.
 */
function computeColumns(appointments: AppointmentWithDetails[]): Map<string, LayoutInfo> {
  const layout = new Map<string, LayoutInfo>();
  if (appointments.length === 0) return layout;

  // Sortiere nach Startzeit
  const sorted = [...appointments].sort((a, b) => {
    return a.time_slot.start_time.localeCompare(b.time_slot.start_time);
  });

  // Baue Überlappungsgruppen
  const groups: AppointmentWithDetails[][] = [];
  let currentGroup: AppointmentWithDetails[] = [];
  let groupEnd = 0;

  for (const apt of sorted) {
    const [h, m] = apt.time_slot.start_time.split(':').map(Number);
    const startMin = h * 60 + m;
    const duration = apt.treatment_type?.duration_minutes || 10;
    const endMin = startMin + duration;

    if (currentGroup.length === 0 || startMin < groupEnd) {
      currentGroup.push(apt);
      groupEnd = Math.max(groupEnd, endMin);
    } else {
      groups.push(currentGroup);
      currentGroup = [apt];
      groupEnd = endMin;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Weise Spalten innerhalb jeder Gruppe zu
  for (const group of groups) {
    const columns: AppointmentWithDetails[][] = [];

    for (const apt of group) {
      const [h, m] = apt.time_slot.start_time.split(':').map(Number);
      const startMin = h * 60 + m;

      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        const [lh, lm] = lastInCol.time_slot.start_time.split(':').map(Number);
        const lastEnd = lh * 60 + lm + (lastInCol.treatment_type?.duration_minutes || 10);

        if (startMin >= lastEnd) {
          columns[col].push(apt);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([apt]);
      }
    }

    const totalColumns = columns.length;
    columns.forEach((col, colIndex) => {
      col.forEach(apt => {
        layout.set(apt.id, { column: colIndex, totalColumns });
      });
    });
  }

  return layout;
}

export function DayView({ date, appointments, onAppointmentClick }: DayViewProps) {
  const dateStr = date.toISOString().split('T')[0];

  // Filter appointments for this day (exclude cancelled)
  const dayAppointments = appointments.filter(
    (apt) => apt.time_slot?.date === dateStr && apt.status !== 'cancelled'
  );

  const columnLayout = computeColumns(dayAppointments);

  // Get appointment position and height based on time
  const getAppointmentStyle = (apt: AppointmentWithDetails) => {
    const [hours, minutes] = apt.time_slot.start_time.split(':').map(Number);
    const startMinutes = (hours - START_HOUR) * 60 + minutes;
    const duration = apt.treatment_type?.duration_minutes || 10;

    const top = startMinutes * PIXELS_PER_MINUTE;
    const height = Math.max(duration * PIXELS_PER_MINUTE, 32); // Mindesthöhe 32px

    const info = columnLayout.get(apt.id);
    const column = info?.column ?? 0;
    const totalColumns = info?.totalColumns ?? 1;
    const widthPercent = 100 / totalColumns;
    const leftPercent = column * widthPercent;

    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${leftPercent}%`,
      width: `calc(${widthPercent}% - 4px)`,
    };
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
            const colors = getColors(apt);
            const isMfa = apt.bookingType === 'mfa';
            const practName = isMfa
              ? 'MFA'
              : apt.practitioner
                ? `${apt.practitioner.title || ''} ${apt.practitioner.last_name}`.trim()
                : '';
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
                  <span className={styles.appointmentTime}>
                    {formatTime(apt.time_slot?.start_time)}
                  </span>
                  <span className={styles.appointmentPatient} style={{ color: colors.text }}>
                    {apt.patient?.name}
                  </span>
                  {practName && (
                    <span className={styles.appointmentPractitioner}>
                      {practName}
                    </span>
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

  const top = ((hours - START_HOUR) * 60 + minutes) * PIXELS_PER_MINUTE;

  return (
    <div className={styles.currentTime} style={{ top: `${top}px` }}>
      <div className={styles.currentTimeDot} />
      <div className={styles.currentTimeLine} />
    </div>
  );
}
