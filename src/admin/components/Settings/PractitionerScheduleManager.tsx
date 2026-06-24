import { useState, useMemo, FormEvent } from 'react';
import { usePractitionerSchedulesAdmin } from '../../hooks';
import type { PractitionerScheduleEntry } from '../../hooks';
import styles from './PractitionerScheduleManager.module.css';
import { formatLocalDate } from '../../../utils/dates';

const JS_DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const JS_DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// Display order: Mon–Sun
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function getMonday(d: Date): Date {
  const day = d.getDay(); // 0=So..6=Sa
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return m;
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

const formatPractitioner = (p: { title: string | null; first_name: string; last_name: string }) => {
  return `${p.title || ''} ${p.first_name} ${p.last_name}`.trim();
};

function getCardClass(entry: PractitionerScheduleEntry): string {
  if (!entry.is_bookable) return styles.cardNotBookable;
  if (entry.insurance_filter === 'private_only') return styles.cardPrivate;
  return styles.cardBookable;
}

export function PractitionerScheduleManager() {
  const {
    schedules,
    practitioners,
    loading,
    error,
    createSchedule,
    deleteSchedule,
  } = usePractitionerSchedulesAdmin();

  const [selectedPractitionerId, setSelectedPractitionerId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  // Form state
  const [mode, setMode] = useState<'recurring' | 'single'>('recurring');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [singleDate, setSingleDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBookable, setIsBookable] = useState(true);
  const [insuranceFilter, setInsuranceFilter] = useState<'all' | 'private_only'>('all');
  const [label, setLabel] = useState('');
  const [validFrom, setValidFrom] = useState(formatLocalDate(new Date()));
  const [validUntil, setValidUntil] = useState('');

  const filteredSchedules = useMemo(() => {
    if (!selectedPractitionerId) return [];
    return schedules.filter(s => s.practitioner_id === selectedPractitionerId);
  }, [schedules, selectedPractitionerId]);

  // Einmalige Schichten = Schedule-Einträge mit valid_from === valid_until
  // Sie tauchen nicht in der Wochenübersicht auf (würde das Bild verwirren),
  // sondern in einer eigenen Sektion "Geplante Schichten".
  const isSingleShift = (s: PractitionerScheduleEntry) =>
    !!s.valid_from && !!s.valid_until && s.valid_from === s.valid_until;

  // Wochen-Grid: pro Datum die anwendbaren Schedules berechnen
  // (recurring matching day_of_week + valid range, plus single-date overrides)
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, { recurring: PractitionerScheduleEntry[]; single: PractitionerScheduleEntry[] }>();
    for (const date of weekDates) {
      const dateStr = formatLocalDate(date);
      const dow = date.getDay();
      const recurring: PractitionerScheduleEntry[] = [];
      const single: PractitionerScheduleEntry[] = [];
      for (const s of filteredSchedules) {
        if (s.day_of_week !== dow) continue;
        const validFromOk = !s.valid_from || s.valid_from <= dateStr;
        const validUntilOk = !s.valid_until || s.valid_until >= dateStr;
        if (!validFromOk || !validUntilOk) continue;
        if (isSingleShift(s)) single.push(s);
        else recurring.push(s);
      }
      const sortFn = (a: PractitionerScheduleEntry, b: PractitionerScheduleEntry) =>
        a.start_time.localeCompare(b.start_time);
      recurring.sort(sortFn);
      single.sort(sortFn);
      map.set(dateStr, { recurring, single });
    }
    return map;
  }, [filteredSchedules, weekDates]);

  const openSingleShiftFormFor = (date: Date) => {
    setMode('single');
    setSingleDate(formatLocalDate(date));
    setStartTime('');
    setEndTime('');
    setIsBookable(true);
    setInsuranceFilter('all');
    setLabel('');
    setFormError(null);
    setShowForm(true);
  };

  const todayStr = formatLocalDate(new Date());

  const resetForm = () => {
    setMode('recurring');
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedPractitionerId) {
      setFormError('Bitte zuerst einen Behandler auswählen');
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

    // Mode 'single' = einmalige Schicht an einem konkreten Datum.
    // day_of_week wird aus dem Datum berechnet, valid_from=valid_until=Datum.
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
    const result = await createSchedule({
      practitioner_id: selectedPractitionerId,
      day_of_week: effectiveDayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_bookable: isBookable,
      insurance_filter: insuranceFilter,
      label: label || undefined,
      valid_from: effectiveValidFrom,
      valid_until: effectiveValidUntil,
    });

    setSaving(false);

    if (result.success) {
      resetForm();
      setShowForm(false);
    } else {
      setFormError(result.error || 'Fehler beim Speichern');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sprechzeit-Eintrag wirklich löschen?')) return;
    await deleteSchedule(id);
  };

  if (loading) {
    return <div className={styles.loading}>Lade Sprechzeiten...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Individuelle Sprechzeiten</h3>
        {selectedPractitionerId && (
          <button
            className={styles.addButton}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Abbrechen' : '+ Sprechzeit anlegen'}
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Practitioner Auswahl */}
      <div className={styles.practitionerSelect}>
        <label htmlFor="schedule-practitioner">Behandler auswählen</label>
        <select
          id="schedule-practitioner"
          value={selectedPractitionerId}
          onChange={(e) => {
            setSelectedPractitionerId(e.target.value);
            setShowForm(false);
          }}
        >
          <option value="">Bitte wählen...</option>
          {practitioners.map((p) => (
            <option key={p.id} value={p.id}>
              {formatPractitioner(p)}
            </option>
          ))}
        </select>
      </div>

      {/* Formular */}
      {showForm && (
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.formError}>{formError}</div>}

          {/* Mode-Toggle: wiederkehrend vs. einmalige Schicht */}
          <div className={styles.formRow} style={{ marginBottom: '0.75rem' }}>
            <div className={styles.field}>
              <label>Art *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 0.75rem',
                    border: `1px solid ${mode === 'recurring' ? '#2674BB' : '#D1D5DB'}`,
                    background: mode === 'recurring' ? '#EBF5FF' : 'white',
                    borderRadius: '6px', cursor: 'pointer', flex: 1,
                  }}
                >
                  <input
                    type="radio" name="schedule-mode"
                    checked={mode === 'recurring'}
                    onChange={() => setMode('recurring')}
                  />
                  Wiederkehrend (jeden Wochentag)
                </label>
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 0.75rem',
                    border: `1px solid ${mode === 'single' ? '#2674BB' : '#D1D5DB'}`,
                    background: mode === 'single' ? '#EBF5FF' : 'white',
                    borderRadius: '6px', cursor: 'pointer', flex: 1,
                  }}
                >
                  <input
                    type="radio" name="schedule-mode"
                    checked={mode === 'single'}
                    onChange={() => setMode('single')}
                  />
                  Einmalig (Schichtplan-Datum)
                </label>
              </div>
            </div>
          </div>

          <div className={styles.formRow3}>
            {mode === 'recurring' ? (
              <div className={styles.field}>
                <label htmlFor="schedule-day">Wochentag *</label>
                <select
                  id="schedule-day"
                  value={dayOfWeek}
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
                  type="date"
                  id="schedule-single-date"
                  value={singleDate}
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
                type="time"
                id="schedule-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="schedule-end">Bis *</label>
              <input
                type="time"
                id="schedule-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.checkboxField}>
              <input
                type="checkbox"
                id="schedule-bookable"
                checked={isBookable}
                onChange={(e) => setIsBookable(e.target.checked)}
              />
              <label htmlFor="schedule-bookable">Online buchbar</label>
            </div>

            {isBookable && (
              <div className={styles.field}>
                <label htmlFor="schedule-insurance">Versicherungsfilter</label>
                <select
                  id="schedule-insurance"
                  value={insuranceFilter}
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
                type="text"
                id="schedule-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z.B. Sprechstunde, OP-Tag, ..."
              />
            </div>

            {mode === 'recurring' && (
              <div className={styles.field}>
                <label htmlFor="schedule-valid-from">Gültig ab</label>
                <input
                  type="date"
                  id="schedule-valid-from"
                  value={validFrom}
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
                  type="date"
                  id="schedule-valid-until"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  min={validFrom}
                />
              </div>
              <div />
            </div>
          )}

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
              {saving ? 'Speichere...' : 'Sprechzeit anlegen'}
            </button>
          </div>
        </form>
      )}

      {/* Schichtplan: Wochen-Grid mit klickbaren Tag-Zellen */}
      {selectedPractitionerId && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            margin: '1.5rem 0 0.75rem 0', paddingTop: '1rem',
            borderTop: '1px solid #E5E7EB',
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: 0, flex: 1 }}>
              Schichtplan — KW {getISOWeek(weekStart)} / {weekStart.getFullYear()}
            </h4>
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              style={{
                padding: '0.375rem 0.75rem', background: 'white',
                border: '1px solid #D1D5DB', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.875rem',
              }}
            >← Woche</button>
            <button
              type="button"
              onClick={() => setWeekStart(getMonday(new Date()))}
              style={{
                padding: '0.375rem 0.75rem', background: 'white',
                border: '1px solid #D1D5DB', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.875rem',
              }}
            >Heute</button>
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              style={{
                padding: '0.375rem 0.75rem', background: 'white',
                border: '1px solid #D1D5DB', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.875rem',
              }}
            >Woche →</button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem',
          }}>
            {weekDates.map((date) => {
              const dateStr = formatLocalDate(date);
              const entry = schedulesByDate.get(dateStr) || { recurring: [], single: [] };
              const isToday = dateStr === todayStr;
              const dow = date.getDay();
              return (
                <div
                  key={dateStr}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    minHeight: 140, padding: '0.5rem',
                    border: `1px solid ${isToday ? '#2674BB' : '#E5E7EB'}`,
                    borderRadius: '8px', background: isToday ? '#F0F7FF' : '#FAFAFA',
                  }}
                >
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: isToday ? '#1E5A8F' : '#6B7280',
                    textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem',
                  }}>
                    {JS_DAY_SHORT[dow]} {date.getDate()}.{date.getMonth() + 1}.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    {entry.recurring.map((s) => (
                      <div
                        key={s.id}
                        title={`Wiederkehrend (${JS_DAY_NAMES[s.day_of_week]})`}
                        className={`${styles.scheduleCard} ${getCardClass(s)}`}
                        style={{
                          padding: '4px 6px', borderStyle: 'dashed', fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                        }}
                      >
                        <span style={{ flex: 1, lineHeight: 1.3 }}>
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          {s.label && <span style={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>{s.label}</span>}
                        </span>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(s.id)}
                          title="Wiederkehrende Schicht löschen"
                          style={{ fontSize: '1rem', padding: '0 4px' }}
                        >×</button>
                      </div>
                    ))}
                    {entry.single.map((s) => (
                      <div
                        key={s.id}
                        title="Einzel-Schicht (nur dieser Tag)"
                        className={`${styles.scheduleCard} ${getCardClass(s)}`}
                        style={{
                          padding: '4px 6px', fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                        }}
                      >
                        <span style={{ flex: 1, lineHeight: 1.3 }}>
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          {s.label && <span style={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>{s.label}</span>}
                        </span>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(s.id)}
                          title="Einzel-Schicht löschen"
                          style={{ fontSize: '1rem', padding: '0 4px' }}
                        >×</button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => openSingleShiftFormFor(date)}
                    style={{
                      marginTop: '0.4rem', padding: '0.3rem 0.4rem',
                      background: 'transparent', border: '1px dashed #9CA3AF',
                      borderRadius: '4px', cursor: 'pointer',
                      fontSize: '0.7rem', color: '#6B7280',
                    }}
                  >+ Schicht</button>
                </div>
              );
            })}
          </div>

          {filteredSchedules.length === 0 && (
            <div className={styles.empty} style={{ marginTop: '0.75rem' }}>
              Keine individuellen Sprechzeiten hinterlegt. Es gelten die Standard-Praxisöffnungszeiten.
            </div>
          )}
        </>
      )}

    </div>
  );
}
