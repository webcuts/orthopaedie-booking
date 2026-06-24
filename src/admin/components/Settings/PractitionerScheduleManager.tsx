import { useState, useMemo, FormEvent } from 'react';
import { usePractitionerSchedulesAdmin } from '../../hooks';
import type { PractitionerScheduleEntry } from '../../hooks';
import styles from './PractitionerScheduleManager.module.css';
import { formatLocalDate } from '../../../utils/dates';

const JS_DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const JS_DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function getISOWeek(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

const formatPractitionerName = (p: { title: string | null; first_name: string; last_name: string }) => {
  return `${p.title || ''} ${p.first_name} ${p.last_name}`.trim();
};

const formatPractitionerShort = (p: { title: string | null; first_name: string; last_name: string }) => {
  return `${p.title ? p.title + ' ' : ''}${p.first_name[0]}. ${p.last_name}`;
};

function getCardClass(entry: PractitionerScheduleEntry): string {
  if (!entry.is_bookable) return styles.cardNotBookable;
  if (entry.insurance_filter === 'private_only') return styles.cardPrivate;
  return styles.cardBookable;
}

const isSingleShift = (s: PractitionerScheduleEntry) =>
  !!s.valid_from && !!s.valid_until && s.valid_from === s.valid_until;

export function PractitionerScheduleManager() {
  const { schedules, practitioners, loading, error, createSchedule, updateSchedule, deleteSchedule } =
    usePractitionerSchedulesAdmin();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'recurring' | 'single'>('recurring');
  const [formPractitionerId, setFormPractitionerId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [singleDate, setSingleDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBookable, setIsBookable] = useState(true);
  const [insuranceFilter, setInsuranceFilter] = useState<'all' | 'private_only'>('all');
  const [label, setLabel] = useState('');
  const [validFrom, setValidFrom] = useState(formatLocalDate(new Date()));
  const [validUntil, setValidUntil] = useState('');

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Pro (practitionerId, dateStr) die anwendbaren Schedules berechnen
  const grid = useMemo(() => {
    const map = new Map<string, { recurring: PractitionerScheduleEntry[]; single: PractitionerScheduleEntry[] }>();
    const key = (pid: string, ds: string) => `${pid}|${ds}`;
    const sortFn = (a: PractitionerScheduleEntry, b: PractitionerScheduleEntry) =>
      a.start_time.localeCompare(b.start_time);
    for (const date of weekDates) {
      const dateStr = formatLocalDate(date);
      const dow = date.getDay();
      for (const p of practitioners) {
        const recurring: PractitionerScheduleEntry[] = [];
        const single: PractitionerScheduleEntry[] = [];
        for (const s of schedules) {
          if (s.practitioner_id !== p.id) continue;
          if (s.day_of_week !== dow) continue;
          const validFromOk = !s.valid_from || s.valid_from <= dateStr;
          const validUntilOk = !s.valid_until || s.valid_until >= dateStr;
          if (!validFromOk || !validUntilOk) continue;
          if (isSingleShift(s)) single.push(s);
          else recurring.push(s);
        }
        recurring.sort(sortFn);
        single.sort(sortFn);
        map.set(key(p.id, dateStr), { recurring, single });
      }
    }
    return map;
  }, [schedules, practitioners, weekDates]);

  const todayStr = formatLocalDate(new Date());

  const resetForm = () => {
    setEditingId(null);
    setMode('recurring');
    setFormPractitionerId('');
    setDayOfWeek(1);
    setSingleDate('');
    setStartTime('');
    setEndTime('');
    setIsBookable(true);
    setInsuranceFilter('all');
    setLabel('');
    setValidFrom(formatLocalDate(new Date()));
    setValidUntil('');
    setFormError(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openSingleShiftFormFor = (practitionerId: string, date: Date) => {
    setEditingId(null);
    setMode('single');
    setFormPractitionerId(practitionerId);
    setSingleDate(formatLocalDate(date));
    setDayOfWeek(date.getDay());
    setStartTime('');
    setEndTime('');
    setIsBookable(true);
    setInsuranceFilter('all');
    setLabel('');
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (s: PractitionerScheduleEntry) => {
    setEditingId(s.id);
    const isSingle = isSingleShift(s);
    setMode(isSingle ? 'single' : 'recurring');
    setFormPractitionerId(s.practitioner_id);
    setDayOfWeek(s.day_of_week);
    setSingleDate(isSingle ? (s.valid_from || '') : '');
    setStartTime(s.start_time.slice(0, 5));
    setEndTime(s.end_time.slice(0, 5));
    setIsBookable(s.is_bookable);
    setInsuranceFilter((s.insurance_filter as 'all' | 'private_only') || 'all');
    setLabel(s.label || '');
    setValidFrom(s.valid_from || formatLocalDate(new Date()));
    setValidUntil(s.valid_until || '');
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formPractitionerId) {
      setFormError('Bitte Behandler auswählen');
      return;
    }
    if (!startTime || !endTime) {
      setFormError('Bitte Start- und Endzeit angeben');
      return;
    }
    if (startTime >= endTime) {
      setFormError('Die Endzeit muss nach der Startzeit liegen');
      return;
    }

    let effectiveDayOfWeek = dayOfWeek;
    let effectiveValidFrom = validFrom;
    let effectiveValidUntil: string | null = validUntil || null;

    if (mode === 'single') {
      if (!singleDate) {
        setFormError('Bitte ein Datum auswählen');
        return;
      }
      effectiveDayOfWeek = new Date(singleDate + 'T00:00:00').getDay();
      effectiveValidFrom = singleDate;
      effectiveValidUntil = singleDate;
    }

    setSaving(true);
    const payload = {
      day_of_week: effectiveDayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_bookable: isBookable,
      insurance_filter: insuranceFilter,
      label: label || null,
      valid_from: effectiveValidFrom,
      valid_until: effectiveValidUntil,
    };
    const result = editingId
      ? await updateSchedule(editingId, payload)
      : await createSchedule({ practitioner_id: formPractitionerId, ...payload, label: label || undefined });

    setSaving(false);

    if (result.success) {
      resetForm();
      setShowForm(false);
    } else {
      setFormError(result.error || 'Fehler beim Speichern');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Sprechzeit-Eintrag wirklich löschen?')) return;
    await deleteSchedule(id);
  };

  if (loading) {
    return <div className={styles.loading}>Lade Sprechzeiten...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Schichtplan — KW {getISOWeek(weekStart)} / {weekStart.getFullYear()}</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className={styles.navButton}
          >← Woche</button>
          <button
            type="button"
            onClick={() => setWeekStart(getMonday(new Date()))}
            className={styles.navButton}
          >Heute</button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className={styles.navButton}
          >Woche →</button>
          <button
            className={styles.addButton}
            onClick={() => (showForm ? setShowForm(false) : openAddForm())}
          >
            {showForm ? 'Abbrechen' : '+ Sprechzeit anlegen'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Formular */}
      {showForm && (
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.formError}>{formError}</div>}

          {editingId && (
            <div style={{
              marginBottom: '0.75rem', padding: '0.5rem 0.75rem',
              background: '#EBF5FF', border: '1px solid #BFDBFE',
              borderRadius: '6px', fontSize: '0.8125rem', color: '#1E5A8F',
            }}>
              Sprechzeit bearbeiten — Änderungen werden auf den bestehenden Eintrag angewendet.
            </div>
          )}

          {/* Behandler + Mode */}
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="schedule-practitioner">Behandler *</label>
              <select
                id="schedule-practitioner"
                value={formPractitionerId}
                onChange={(e) => setFormPractitionerId(e.target.value)}
                required
                disabled={!!editingId}
              >
                <option value="">Bitte wählen...</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>{formatPractitionerName(p)}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Art *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['recurring', 'single'] as const).map((m) => (
                  <label
                    key={m}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.5rem 0.75rem',
                      border: `1px solid ${mode === m ? '#2674BB' : '#D1D5DB'}`,
                      background: mode === m ? '#EBF5FF' : 'white',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
                    }}
                  >
                    <input
                      type="radio" name="schedule-mode" checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    {m === 'recurring' ? 'Wiederkehrend' : 'Einmalig'}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.formRow3}>
            {mode === 'recurring' ? (
              <div className={styles.field}>
                <label htmlFor="schedule-day">Wochentag *</label>
                <select
                  id="schedule-day" value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                >
                  {DISPLAY_ORDER.map((d) => (
                    <option key={d} value={d}>{JS_DAY_NAMES[d]}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.field}>
                <label htmlFor="schedule-single-date">Datum *</label>
                <input
                  type="date" id="schedule-single-date" value={singleDate}
                  min={formatLocalDate(new Date())}
                  onChange={(e) => setSingleDate(e.target.value)}
                  required
                />
                {singleDate && (
                  <small style={{ color: '#6B7280', marginTop: '4px' }}>
                    {JS_DAY_NAMES[new Date(singleDate + 'T00:00:00').getDay()]}
                  </small>
                )}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="schedule-start">Von *</label>
              <input
                type="time" id="schedule-start" value={startTime}
                onChange={(e) => setStartTime(e.target.value)} required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="schedule-end">Bis *</label>
              <input
                type="time" id="schedule-end" value={endTime}
                onChange={(e) => setEndTime(e.target.value)} required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.checkboxField}>
              <input
                type="checkbox" id="schedule-bookable"
                checked={isBookable}
                onChange={(e) => setIsBookable(e.target.checked)}
              />
              <label htmlFor="schedule-bookable">Online buchbar</label>
            </div>
            {isBookable && (
              <div className={styles.field}>
                <label htmlFor="schedule-insurance">Versicherungsfilter</label>
                <select
                  id="schedule-insurance" value={insuranceFilter}
                  onChange={(e) => setInsuranceFilter(e.target.value as 'all' | 'private_only')}
                >
                  <option value="all">Alle Patienten</option>
                  <option value="private_only">Nur Privatpatienten</option>
                </select>
              </div>
            )}
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="schedule-label">Bezeichnung (optional)</label>
              <input
                type="text" id="schedule-label" value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z.B. Sprechstunde, OP-Tag, ..."
              />
            </div>
            {mode === 'recurring' && (
              <div className={styles.field}>
                <label htmlFor="schedule-valid-from">Gültig ab</label>
                <input
                  type="date" id="schedule-valid-from" value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
            )}
          </div>

          {mode === 'recurring' && (
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label htmlFor="schedule-valid-until">Gültig bis (leer = unbegrenzt)</label>
                <input
                  type="date" id="schedule-valid-until" value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)} min={validFrom}
                />
              </div>
              <div />
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="button" className={styles.cancelButton}
              onClick={() => { resetForm(); setShowForm(false); }}
            >Abbrechen</button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving
                ? 'Speichere...'
                : editingId ? 'Änderungen speichern' : 'Sprechzeit anlegen'}
            </button>
          </div>
        </form>
      )}

      {/* Multi-Behandler Wochen-Grid */}
      {practitioners.length === 0 ? (
        <div className={styles.empty}>Keine aktiven Behandler gefunden.</div>
      ) : (
        <div className={styles.gridScroll}>
          <div className={styles.gridTable}>
            {/* Header-Zeile: Wochentage */}
            <div className={styles.gridHeader}>
              <div className={styles.headerCorner}>Behandler</div>
              {weekDates.map((date) => {
                const dateStr = formatLocalDate(date);
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    className={`${styles.headerDay} ${isToday ? styles.headerDayToday : ''}`}
                  >
                    <div className={styles.headerDayLabel}>{JS_DAY_SHORT[date.getDay()]}</div>
                    <div className={styles.headerDayDate}>
                      {date.getDate()}.{date.getMonth() + 1}.
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Eine Zeile pro Behandler */}
            {practitioners.map((p) => (
              <div key={p.id} className={styles.gridRow}>
                <div className={styles.practitionerCell}>
                  <span className={styles.practitionerName}>{formatPractitionerShort(p)}</span>
                </div>
                {weekDates.map((date) => {
                  const dateStr = formatLocalDate(date);
                  const entry = grid.get(`${p.id}|${dateStr}`) || { recurring: [], single: [] };
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={dateStr}
                      className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''}`}
                    >
                      <div className={styles.dayCellShifts}>
                        {entry.recurring.map((s) => (
                          <div
                            key={s.id}
                            title={`Wiederkehrend (${JS_DAY_NAMES[s.day_of_week]})${s.label ? ' · ' + s.label : ''} — klicken zum Bearbeiten`}
                            className={`${styles.shiftChip} ${getCardClass(s)} ${styles.shiftRecurring}`}
                            onClick={() => openEditForm(s)}
                            role="button"
                          >
                            <span className={styles.shiftTime}>
                              {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                            </span>
                            <button
                              className={styles.shiftDelete}
                              onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                              title="Löschen"
                            >×</button>
                          </div>
                        ))}
                        {entry.single.map((s) => (
                          <div
                            key={s.id}
                            title={`Einzel-Schicht${s.label ? ' · ' + s.label : ''} — klicken zum Bearbeiten`}
                            className={`${styles.shiftChip} ${getCardClass(s)}`}
                            onClick={() => openEditForm(s)}
                            role="button"
                          >
                            <span className={styles.shiftTime}>
                              {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                            </span>
                            <button
                              className={styles.shiftDelete}
                              onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                              title="Löschen"
                            >×</button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.cellAddBtn}
                        onClick={() => openSingleShiftFormFor(p.id, date)}
                        title="Einzel-Schicht für diesen Tag hinzufügen"
                      >+</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
