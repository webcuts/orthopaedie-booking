import { useSystemLogs, type SystemLog } from '../../hooks';
import styles from './SystemStatus.module.css';

const EVENT_COLORS: Record<string, string> = {
  slot_generation: '#2674BB',
  booking: '#22C55E',
  cancellation: '#F59E0B',
  error: '#DC3545',
  email: '#8B5CF6',
};

function getEventColor(eventType: string): string {
  return EVENT_COLORS[eventType] || '#6B7280';
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SystemStatus() {
  const { logs, loading, error, refetch } = useSystemLogs();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Systemstatus</h3>
        </div>
        <div className={styles.loading}>Lade Logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Systemstatus</h3>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Systemstatus</h3>
        <button className={styles.refreshButton} onClick={refetch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className={styles.empty}>Keine Logs vorhanden</div>
      ) : (
        <div className={styles.logList}>
          {logs.map((log: SystemLog) => (
            <div key={log.id} className={styles.logItem}>
              <span
                className={styles.eventBadge}
                style={{ backgroundColor: getEventColor(log.event_type) }}
              >
                {log.event_type}
              </span>
              <span className={styles.logMessage}>{log.message}</span>
              <span className={styles.logTime}>{formatTimestamp(log.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
