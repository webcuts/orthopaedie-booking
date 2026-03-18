import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import styles from './ActivityLogPage.module.css';

interface LogEntry {
  id: string;
  event_type: string;
  message: string;
  details: Record<string, any> | null;
  created_at: string;
  user_id: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  booking: 'Buchung',
  cancellation: 'Stornierung',
  staff: 'Mitarbeiter',
  email: 'E-Mail',
  sms: 'SMS',
  error: 'Fehler',
  warning: 'Warnung',
  slot_generation: 'Slot-Generierung',
  prescription_completed: 'Rezept erledigt',
  absence_created: 'Abwesenheit',
  appointment_confirmed: 'Termin bestätigt',
  appointment_cancelled: 'Termin storniert',
  appointment_rescheduled: 'Termin verlegt',
};

const EVENT_COLORS: Record<string, string> = {
  booking: '#22C55E',
  cancellation: '#DC3545',
  staff: '#7C3AED',
  email: '#2563EB',
  sms: '#0891B2',
  error: '#DC2626',
  warning: '#D97706',
  slot_generation: '#6B7280',
  prescription_completed: '#7C3AED',
  absence_created: '#F59E0B',
  appointment_confirmed: '#22C55E',
  appointment_cancelled: '#DC3545',
  appointment_rescheduled: '#2563EB',
};

type DateRange = '1' | '7' | '30' | 'alle';

export function ActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffMembers, setStaffMembers] = useState<{ id: string; display_name: string }[]>([]);
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());

  // Filters
  const [staffFilter, setStaffFilter] = useState<string>('alle');
  const [typeFilter, setTypeFilter] = useState<string>('alle');
  const [dateRange, setDateRange] = useState<DateRange>('7');

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (staffFilter !== 'alle') {
      query = query.eq('user_id', staffFilter);
    }

    if (typeFilter !== 'alle') {
      query = query.eq('event_type', typeFilter);
    }

    if (dateRange !== 'alle') {
      const days = parseInt(dateRange);
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte('created_at', since.toISOString());
    }

    const { data } = await query;
    setLogs((data || []) as LogEntry[]);

    // Profilnamen laden
    const userIds = [...new Set((data || []).filter((l: any) => l.user_id).map((l: any) => l.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('admin_profiles')
        .select('id, display_name')
        .in('id', userIds);

      const nameMap = new Map<string, string>();
      (profiles || []).forEach((p: any) => nameMap.set(p.id, p.display_name));
      setProfileNames(nameMap);
    }

    setLoading(false);
  }, [staffFilter, typeFilter, dateRange]);

  const fetchStaffMembers = useCallback(async () => {
    const { data } = await supabase
      .from('admin_profiles')
      .select('id, display_name')
      .eq('is_active', true)
      .order('display_name');
    if (data) setStaffMembers(data);
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStaffMembers();
  }, [fetchLogs, fetchStaffMembers]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const exportCsv = () => {
    const header = 'Zeitpunkt;Benutzer;Typ;Nachricht;Details\n';
    const rows = logs.map(log => {
      const user = log.user_id ? profileNames.get(log.user_id) || '–' : 'System';
      const details = log.details ? JSON.stringify(log.details) : '';
      return `${formatDate(log.created_at)};${user};${log.event_type};${log.message};${details}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aktivitaeten_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unique event types for filter
  const eventTypes = [...new Set(logs.map(l => l.event_type))].sort();

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Aktivitätsprotokoll</h1>
        <div className={styles.headerActions}>
          <button className={styles.refreshButton} onClick={fetchLogs}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Aktualisieren
          </button>
          <button className={styles.exportButton} onClick={exportCsv}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Mitarbeiter:</label>
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className={styles.filterSelect}>
            <option value="alle">Alle</option>
            {staffMembers.map(s => (
              <option key={s.id} value={s.id}>{s.display_name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Typ:</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={styles.filterSelect}>
            <option value="alle">Alle Typen</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{EVENT_LABELS[t] || t}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Zeitraum:</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} className={styles.filterSelect}>
            <option value="1">Heute</option>
            <option value="7">Letzte 7 Tage</option>
            <option value="30">Letzte 30 Tage</option>
            <option value="alle">Alle</option>
          </select>
        </div>
      </div>

      <div className={styles.count}>{logs.length} Einträge</div>

      {/* Log List */}
      {loading ? (
        <div className={styles.loading}>Lade Aktivitäten...</div>
      ) : logs.length === 0 ? (
        <div className={styles.empty}>Keine Aktivitäten im gewählten Zeitraum.</div>
      ) : (
        <div className={styles.list}>
          {logs.map(log => (
            <div key={log.id} className={styles.logEntry}>
              <div className={styles.logDot} style={{ background: EVENT_COLORS[log.event_type] || '#9CA3AF' }} />
              <div className={styles.logContent}>
                <div className={styles.logHeader}>
                  <span className={styles.logType} style={{ color: EVENT_COLORS[log.event_type] || '#9CA3AF' }}>
                    {EVENT_LABELS[log.event_type] || log.event_type}
                  </span>
                  <span className={styles.logTime}>{formatDate(log.created_at)}</span>
                </div>
                <div className={styles.logMessage}>{log.message}</div>
                {log.user_id && (
                  <div className={styles.logUser}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {profileNames.get(log.user_id) || '–'}
                  </div>
                )}
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className={styles.logDetails}>
                    {Object.entries(log.details).map(([key, value]) => (
                      <span key={key} className={styles.logDetailItem}>
                        {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
