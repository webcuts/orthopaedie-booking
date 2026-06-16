import { useState, FormEvent } from 'react';
import { usePractitionerAbsences, type PractitionerAbsence } from '../../hooks';
import styles from './AbsenceManager.module.css';
import { formatLocalDate } from '../../../utils/dates';

const REASON_LABELS: Record<string, string> = {
  sick: 'Krankheit',
  vacation: 'Urlaub',
  other: 'Sonstiges',
};

const REASON_COLORS: Record<string, string> = {
  sick: '#FEE2E2',
  vacation: '#DBEAFE',
  other: '#F3F4F6',
};

type TimePreset = 'full' | 'morning' | 'afternoon' | 'custom';

const TIME_PRESET_LABELS: Record<TimePreset, string> = {
  full:      'Ganztägig',
  morning:   'Vormittag (bis 12:00 Uhr)',
  afternoon: 'Nachmittag (ab 14:00 Uhr)',
  custom:    'Eigener Zeitraum',
};

const TIME_PRESET_RANGES: Record<Exclude<TimePreset, 'full' | 'custom'>, { start: string; end: string }> = {
  morning:   { start: '00:00', end: '12:00' },
  afternoon: { start: '14:00', end: '23:59' },
};

function rangeLabel(start: string, end: string): string {
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  if (s === '00:00' && e === '12:00') return 'Vormittag (bis 12:00)';
  if (s === '14:00' && e === '23:59') return 'Nachmittag (ab 14:00)';
  return `${s}–${e}`;
}

export function AbsenceManager() {
  const {
    absences,
    practitioners,
    loading,
    error,
    createAbsence,
    deleteAbsence,
    countAppointmentsForAbsence,
    cancelAppointmentsForAbsence,
  } = usePractitionerAbsences();

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [practitionerId, setPractitionerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timePreset, setTimePreset] = useState<TimePreset>('full');
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('12:00');
  const [reason, setReason] = useState<'sick' | 'vacation' | 'other'>('vacation');
  const [note, setNote] = useState('');
  const [showOnWebsite, setShowOnWebsite] = useState(true);
  const [publicMessage, setPublicMessage] = useState('');

  const resetForm = () => {
    setPractitionerId('');
    setStartDate('');
    setEndDate('');
    setTimePreset('full');
    setCustomStart('09:00');
    setCustomEnd('12:00');
    setReason('vacation');
    setNote('');
    setShowOnWebsite(true);
    setPublicMessage('');
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!practitionerId || !startDate || !endDate) {
      setFormError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setFormError('Das Enddatum muss nach dem Startdatum liegen');
      return;
    }

    let start_time: string | null = null;
    let end_time: string | null = null;
    if (timePreset === 'morning' || timePreset === 'afternoon') {
      ({ start: start_time, end: end_time } = TIME_PRESET_RANGES[timePreset]);
    } else if (timePreset === 'custom') {
      if (customStart >= customEnd) {
        setFormError('Endzeit muss nach Startzeit liegen');
        return;
      }
      start_time = customStart;
      end_time = customEnd;
    }

    setSaving(true);
    const result = await createAbsence({
      practitioner_id: practitionerId,
      start_date: startDate,
      end_date: endDate,
      start_time,
      end_time,
      reason,
      note: note || undefined,
      show_on_website: showOnWebsite,
      public_message: publicMessage || undefined,
    });

    setSaving(false);

    if (result.success) {
      resetForm();
      setShowForm(false);
      // Nach Anlegen: zählen wie viele Termine im Zeitraum existieren und ggf.
      // direkt zum Absagen einladen. Spart den manuellen Klick auf den Button.
      const tempAbsence: PractitionerAbsence = {
        id: '',
        practitioner_id: practitionerId,
        start_date: startDate,
        end_date: endDate,
        start_time,
        end_time,
        reason,
        note: null,
        show_on_website: showOnWebsite,
        public_message: null,
        created_at: '',
      };
      const count = await countAppointmentsForAbsence(tempAbsence);
      if (count > 0) {
        const ok = window.confirm(
          `Es existieren ${count} Termin${count > 1 ? 'e' : ''} in diesem Zeitraum.\n\n` +
          `Sollen diese Termine direkt storniert und die Patienten per E-Mail benachrichtigt werden?`
        );
        if (ok) {
          const cancelRes = await cancelAppointmentsForAbsence(tempAbsence);
          if (cancelRes.success) {
            window.alert(`${cancelRes.cancelled} Termine storniert. Absage-Mails wurden verschickt.`);
          } else {
            window.alert(`Fehler beim Stornieren: ${cancelRes.error}`);
          }
        }
      }
    } else {
      setFormError(result.error || 'Fehler beim Speichern');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Abwesenheit wirklich löschen?')) return;
    await deleteAbsence(id);
  };

  const handleCancelAppointments = async (absence: PractitionerAbsence) => {
    setCancellingId(absence.id);
    try {
      const count = await countAppointmentsForAbsence(absence);
      if (count === 0) {
        window.alert('Keine offenen Termine in diesem Zeitraum.');
        return;
      }
      const ok = window.confirm(
        `${count} Termin${count > 1 ? 'e' : ''} im Abwesenheits-Zeitraum werden storniert ` +
        `und die Patienten per E-Mail benachrichtigt.\n\nFortfahren?`
      );
      if (!ok) return;
      const res = await cancelAppointmentsForAbsence(absence);
      if (res.success) {
        window.alert(`${res.cancelled} Termine storniert. Absage-Mails wurden verschickt.`);
      } else {
        window.alert(`Fehler: ${res.error}`);
      }
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatPractitioner = (p: { title: string | null; first_name: string; last_name: string }) => {
    return `${p.title || ''} ${p.first_name} ${p.last_name}`.trim();
  };

  if (loading) {
    return <div className={styles.loading}>Lade Abwesenheiten...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Behandler-Abwesenheiten</h3>
        <button
          className={styles.addButton}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Abbrechen' : '+ Abwesenheit eintragen'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Formular */}
      {showForm && (
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.formError}>{formError}</div>}

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="practitioner">Behandler *</label>
              <select
                id="practitioner"
                value={practitionerId}
                onChange={(e) => setPractitionerId(e.target.value)}
                required
              >
                <option value="">Bitte wählen...</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPractitioner(p)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="reason">Grund *</label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as 'sick' | 'vacation' | 'other')}
              >
                <option value="vacation">Urlaub</option>
                <option value="sick">Krankheit</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="startDate">Von *</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={formatLocalDate(new Date())}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="endDate">Bis *</label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || formatLocalDate(new Date())}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="timePreset">Zeitraum *</label>
              <select
                id="timePreset"
                value={timePreset}
                onChange={(e) => setTimePreset(e.target.value as TimePreset)}
              >
                {(Object.keys(TIME_PRESET_LABELS) as TimePreset[]).map((p) => (
                  <option key={p} value={p}>{TIME_PRESET_LABELS[p]}</option>
                ))}
              </select>
            </div>
            {timePreset === 'custom' && (
              <div className={styles.field}>
                <label>Von – Bis</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            )}
          </div>

          {timePreset !== 'full' && startDate && endDate && startDate !== endDate && (
            <div className={styles.warning}>
              Der Zeitraum gilt <strong>an jedem Tag</strong> innerhalb des Datumsbereichs
              (z.&nbsp;B. „Vormittag" = jeden Tag 00:00–12:00 geblockt, Rest des Tages buchbar).
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="note">Notiz (optional)</label>
            <input
              type="text"
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Vertretung durch..."
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOnWebsite}
                  onChange={(e) => setShowOnWebsite(e.target.checked)}
                />
                Auf Website anzeigen
              </label>
            </div>
          </div>

          {showOnWebsite && (
            <div className={styles.field}>
              <label htmlFor="publicMessage">Eigener Hinweistext (optional)</label>
              <input
                type="text"
                id="publicMessage"
                value={publicMessage}
                onChange={(e) => setPublicMessage(e.target.value)}
                placeholder="z.B. Vertretung durch Dr. Jonda. Wird auf der Website angezeigt."
              />
            </div>
          )}

          <div className={styles.warning}>
            <strong>Hinweis:</strong> Beim Speichern werden alle betroffenen Termine
            automatisch storniert und die Patienten benachrichtigt.
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={saving}
            >
              {saving ? 'Speichere...' : 'Abwesenheit eintragen'}
            </button>
          </div>
        </form>
      )}

      {/* Liste der Abwesenheiten */}
      <div className={styles.list}>
        {absences.length === 0 ? (
          <div className={styles.empty}>
            Keine aktuellen oder zukünftigen Abwesenheiten eingetragen.
          </div>
        ) : (
          absences.map((absence) => (
            <div
              key={absence.id}
              className={styles.absenceCard}
              style={{ backgroundColor: REASON_COLORS[absence.reason] }}
            >
              <div className={styles.absenceContent}>
                <div className={styles.absenceHeader}>
                  <span className={styles.practitionerName}>
                    {absence.practitioner && formatPractitioner(absence.practitioner)}
                  </span>
                  <span className={styles.reasonBadge}>
                    {REASON_LABELS[absence.reason]}
                  </span>
                </div>
                <div className={styles.absenceDates}>
                  {formatDate(absence.start_date)} – {formatDate(absence.end_date)}
                  {absence.start_time && absence.end_time && (
                    <span style={{ marginLeft: '0.5rem' }}>
                      <span className={styles.reasonBadge} style={{ background: '#FEF3C7' }}>
                        {rangeLabel(absence.start_time, absence.end_time)}
                      </span>
                    </span>
                  )}
                </div>
                {absence.note && (
                  <div className={styles.absenceNote}>{absence.note}</div>
                )}
                {absence.show_on_website && (
                  <div className={styles.absenceNote} style={{ color: '#2674BB', fontSize: '11px' }}>
                    Website-Banner aktiv{absence.public_message ? `: "${absence.public_message}"` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleCancelAppointments(absence)}
                  disabled={cancellingId === absence.id}
                  title="Alle Termine in diesem Zeitraum stornieren und Patienten benachrichtigen"
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: cancellingId === absence.id ? '#9CA3AF' : '#DC2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: cancellingId === absence.id ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cancellingId === absence.id ? 'Wird gesendet…' : '📧 Termine absagen'}
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete(absence.id)}
                  title="Abwesenheit löschen"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
