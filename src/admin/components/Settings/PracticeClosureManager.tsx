import { useState, useEffect, useCallback, FormEvent } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { formatLocalDate } from '../../../utils/dates';
import styles from './AbsenceManager.module.css';

interface PracticeClosure {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at: string;
}

type Preset = 'morning' | 'afternoon' | 'full' | 'custom';

const PRESET_RANGES: Record<Exclude<Preset, 'custom'>, { start: string; end: string }> = {
  morning:   { start: '00:00', end: '12:00' },
  afternoon: { start: '14:00', end: '23:59' },
  full:      { start: '00:00', end: '23:59' },
};

const PRESET_LABELS: Record<Preset, string> = {
  morning:   'Vormittag (bis 12:00 Uhr)',
  afternoon: 'Nachmittag (ab 14:00 Uhr)',
  full:      'Ganzer Tag',
  custom:    'Eigener Zeitraum',
};

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function rangeLabel(start: string, end: string): string {
  const isFullDay = start.startsWith('00:00') && end.startsWith('23:59');
  if (isFullDay) return 'Ganzer Tag';
  if (start.startsWith('00:00')) return `Vormittag bis ${formatTime(end)}`;
  if (end.startsWith('23:59')) return `Nachmittag ab ${formatTime(start)}`;
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function PracticeClosureManager() {
  const [closures, setClosures] = useState<PracticeClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [preset, setPreset] = useState<Preset>('morning');
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('12:00');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const today = formatLocalDate(new Date());
    const { data, error: e } = await supabase
      .from('practice_blocked_periods')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    if (e) setError(e.message);
    else setClosures(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setDate('');
    setPreset('morning');
    setCustomStart('09:00');
    setCustomEnd('12:00');
    setReason('');
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError('Bitte ein Datum wählen');
      return;
    }

    const { start_time, end_time } = preset === 'custom'
      ? { start_time: customStart, end_time: customEnd }
      : { start_time: PRESET_RANGES[preset].start, end_time: PRESET_RANGES[preset].end };

    if (start_time >= end_time) {
      setFormError('Endzeit muss nach Startzeit liegen');
      return;
    }

    setSaving(true);
    const { error: insErr } = await supabase
      .from('practice_blocked_periods')
      .insert({
        date,
        start_time,
        end_time,
        reason: reason.trim() || null,
      });
    setSaving(false);

    if (insErr) {
      setFormError(insErr.message);
      return;
    }
    resetForm();
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Diese Schließung wirklich löschen?')) return;
    const { error: delErr } = await supabase
      .from('practice_blocked_periods').delete().eq('id', id);
    if (delErr) {
      window.alert(`Fehler: ${delErr.message}`);
      return;
    }
    load();
  };

  const todayIso = formatLocalDate(new Date());

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Praxis-Schließungen</h2>
        {!showForm && (
          <button className={styles.addButton} onClick={() => setShowForm(true)}>
            + Schließung eintragen
          </button>
        )}
      </div>

      <p style={{ margin: '-0.5rem 0 1.5rem', color: '#6B7280', fontSize: '0.875rem' }}>
        Ganze oder halbe Tage sperren, an denen die Praxis nicht buchbar ist
        (z.&nbsp;B. interne Veranstaltungen). Gilt für alle Behandler.
      </p>

      {showForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Datum *</label>
              <input
                type="date"
                value={date}
                min={todayIso}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label>Zeitraum *</label>
              <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                {(Object.keys(PRESET_LABELS) as Preset[]).map(p => (
                  <option key={p} value={p}>{PRESET_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {preset === 'custom' && (
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>Von</label>
                <input
                  type="time"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Bis</label>
                <input
                  type="time"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className={styles.formRow} style={{ gridTemplateColumns: '1fr' }}>
            <div className={styles.field}>
              <label>Grund (optional)</label>
              <input
                type="text"
                placeholder="z. B. Praxisinterne Veranstaltung"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          {formError && <div className={styles.formError}>{formError}</div>}

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => { resetForm(); setShowForm(false); }}
              disabled={saving}
            >
              Abbrechen
            </button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving ? 'Wird gespeichert...' : 'Schließung eintragen'}
            </button>
          </div>
        </form>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Lade Schließungen...</div>
      ) : closures.length === 0 ? (
        <div className={styles.empty}>Keine zukünftigen Schließungen eingetragen.</div>
      ) : (
        <div className={styles.list}>
          {closures.map((c) => (
            <div
              key={c.id}
              className={styles.absenceCard}
              style={{ background: '#FEF3C7' }}
            >
              <div className={styles.absenceContent}>
                <div className={styles.absenceHeader}>
                  <span className={styles.practitionerName}>{formatDateLong(c.date)}</span>
                  <span className={styles.reasonBadge}>{rangeLabel(c.start_time, c.end_time)}</span>
                </div>
                {c.reason && (
                  <div className={styles.absenceDates}>{c.reason}</div>
                )}
              </div>
              <button
                className={styles.deleteButton}
                onClick={() => handleDelete(c.id)}
                aria-label="Schließung löschen"
                title="Schließung löschen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
