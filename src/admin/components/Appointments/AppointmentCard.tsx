import type { AppointmentWithDetails } from '../../hooks';
import styles from './AppointmentCard.module.css';

interface AppointmentCardProps {
  appointment: AppointmentWithDetails;
  onClick: () => void;
  compact?: boolean;
  mini?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  pending: { bg: '#FEF3C7', border: '#F59E0B' },
  confirmed: { bg: '#D1FAE5', border: '#22C55E' },
  cancelled: { bg: '#FEE2E2', border: '#DC3545' },
  completed: { bg: '#F3F4F6', border: '#6B7280' },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  confirmed: 'Bestätigt',
  cancelled: 'Storniert',
  completed: 'Erledigt',
};

export function AppointmentCard({
  appointment,
  onClick,
  compact = false,
  mini = false,
}: AppointmentCardProps) {
  const colors = STATUS_COLORS[appointment.status] || STATUS_COLORS.pending;

  const cardStyle = {
    backgroundColor: colors.bg,
    borderLeftColor: colors.border,
  };

  if (mini) {
    return (
      <div
        className={`${styles.card} ${styles.mini}`}
        style={cardStyle}
        onClick={onClick}
        title={`${appointment.patient?.name} - ${appointment.treatment_type?.name}`}
      >
        <span className={styles.miniTime}>
          {appointment.time_slot?.start_time?.slice(0, 5)}
        </span>
        <span className={styles.miniName}>
          {appointment.patient?.name?.split(' ')[0]}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`${styles.card} ${styles.compact}`}
        style={cardStyle}
        onClick={onClick}
      >
        <div className={styles.compactHeader}>
          <span className={styles.time}>
            {appointment.time_slot?.start_time?.slice(0, 5)}
          </span>
          <span
            className={styles.statusBadge}
            style={{ backgroundColor: colors.border }}
          >
            {STATUS_LABELS[appointment.status]}
          </span>
        </div>
        <div className={styles.patientName}>{appointment.patient?.name}</div>
        <div className={styles.treatmentName}>
          {appointment.treatment_type?.name}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card} style={cardStyle} onClick={onClick}>
      <div className={styles.header}>
        <span className={styles.time}>
          {appointment.time_slot?.start_time?.slice(0, 5)} -{' '}
          {appointment.time_slot?.end_time?.slice(0, 5)}
        </span>
        <span
          className={styles.statusBadge}
          style={{ backgroundColor: colors.border }}
        >
          {STATUS_LABELS[appointment.status]}
        </span>
      </div>
      <div className={styles.patientName}>{appointment.patient?.name}</div>
      <div className={styles.treatmentName}>
        {appointment.treatment_type?.name}
      </div>
      {appointment.practitioner && (
        <div className={styles.practitioner}>
          {appointment.practitioner.title}{' '}
          {appointment.practitioner.first_name}{' '}
          {appointment.practitioner.last_name}
        </div>
      )}
    </div>
  );
}
