import type { AppointmentWithDetails } from '../../hooks';
import styles from './WeekView.module.css';

interface WeekViewProps {
  date: Date;
  appointments: AppointmentWithDetails[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const START_HOUR = 7;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const PIXELS_PER_HOUR = 80;
const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

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

function computeColumns(appointments: AppointmentWithDetails[]): Map<string, LayoutInfo> {
  const layout = new Map<string, LayoutInfo>();
  if (appointments.length === 0) return layout;

  const sorted = [...appointments].sort((a, b) =>
    a.time_slot.start_time.localeCompare(b.time_slot.start_time)
  );

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

  for (const group of groups) {
    const columns: AppointmentWithDetails[][] = [];
    for (const apt of group) {
      const [h, m] = apt.time_slot.start_time.split(':').map(Number);
      const startMin = h * 60 + m;
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const last = columns[col][columns[col].length - 1];
        const [lh, lm] = last.time_slot.start_time.split(':').map(Number);
        const lastEnd = lh * 60 + lm + (last.treatment_type?.duration_minutes || 10);
        if (startMin >= lastEnd) {
          columns[col].push(apt);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([apt]);
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

export function WeekView({ date, appointments, onAppointmentClick }: WeekViewProps) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date().toISOString().split('T')[0];

  const appointmentsByDay = weekDays.map((d) => {
    const dateStr = d.toISOString().split('T')[0];
    return appointments.filter(
      (apt) => apt.time_slot?.date === dateStr && apt.status !== 'cancelled'
    );
  });

  const getAppointmentStyle = (apt: AppointmentWithDetails, layout: Map<string, LayoutInfo>) => {
    const [hours, minutes] = apt.time_slot.start_time.split(':').map(Number);
    const startMinutes = (hours - START_HOUR) * 60 + minutes;
    const duration = apt.treatment_type?.duration_minutes || 10;

    const top = startMinutes * PIXELS_PER_MINUTE;
    const height = Math.max(duration * PIXELS_PER_MINUTE, 24);

    const info = layout.get(apt.id);
    const column = info?.column ?? 0;
    const totalColumns = info?.totalColumns ?? 1;
    const widthPercent = 100 / totalColumns;
    const leftPercent = column * widthPercent;

    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${leftPercent}%`,
      width: `calc(${widthPercent}% - 2px)`,
    };
  };

  return (
    <div className={styles.weekView}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.timeHeader} />
        {weekDays.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0];
          const isToday = dateStr === today;
          const count = appointmentsByDay[i].length;
          return (
            <div
              key={i}
              className={`${styles.dayHeader} ${isToday ? styles.today : ''}`}
            >
              <span className={styles.weekday}>{WEEKDAYS[i]}</span>
              <span className={styles.dayNumber}>{d.getDate()}</span>
              {count > 0 && (
                <span className={styles.dayCount}>{count} Termine</span>
              )}
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
          const layout = computeColumns(dayApts);

          return (
            <div
              key={dayIndex}
              className={`${styles.dayColumn} ${isToday ? styles.todayColumn : ''}`}
            >
              {HOURS.map((hour) => (
                <div key={hour} className={styles.hourCell} />
              ))}

              <div className={styles.appointments}>
                {dayApts.map((apt) => {
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
                        ...getAppointmentStyle(apt, layout),
                        backgroundColor: colors.bg,
                        borderLeftColor: colors.border,
                      }}
                      onClick={() => onAppointmentClick(apt)}
                      title={`${apt.time_slot.start_time.slice(0, 5)} ${apt.patient?.name}${practName ? ` - ${practName}` : ''}`}
                    >
                      <div className={styles.aptLine}>
                        <span className={styles.aptTime}>
                          {apt.time_slot.start_time.slice(0, 5)}
                        </span>
                        <span className={styles.aptPatient} style={{ color: colors.text }}>
                          {apt.patient?.name}
                        </span>
                      </div>
                      {practName && (
                        <div className={styles.aptPractitioner}>{practName}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
