import { useState, useMemo, FormEvent } from 'react';
import { usePractitionerSchedulesAdmin } from '../../hooks';
import type { PractitionerScheduleEntry } from '../../hooks';
import styles from './PractitionerScheduleManager.module.css';
import { formatLocalDate } from '../../../utils/dates';

const JS_DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
// Display order: Mon–Sun
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const formatPractitioner = (p: { title: string | null; first_name: string; last_name: string }) => {
  return `${p.title || ''} ${p.first_name} ${p.last_name}`.trim();
};

function getCardClass(entry: PractitionerScheduleEntry): string {
  if (!entry.is_bookable) return styles.cardNotBookable;
  if (entry.insurance_filter === 'private_only') return styles.cardPrivate;
  return styles.cardBookable;
}

function getCardBadge(entry: PractitionerScheduleEntry): string | null {
  if (!entry.is_bookable) return 'Nicht buchbar';
  if (entry.insurance_filter === 'private_only') return 'Nur privat';
  return 'Buchbar';
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

  const recurringSchedules = useMemo(
    () => filteredSchedules.filter((s) => !isSingleShift(s)),
    [filteredSchedules]
  );

  const singleShifts = useMemo(() => {
    const today = formatLocalDate(new Date());
    return filteredSchedules
      .filter(isSingleShift)
      .filter((s) => (s.valid_until || '') >= today) // nur künftige (inkl. heute)
      .sort((a, b) => (a.valid_from || '').localeCompare(b.valid_from || ''));
  }, [filteredSchedules]);

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, PractitionerScheduleEntry[]>();
    for (const s of recurringSchedules) {
      const existing = map.get(s.day_of_week) || [];
      existing.push(s);
      map.set(s.day_of_week, existing);
    }
    return map;
  }, [recurringSchedules]);

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

      {/* Wochenübersicht */}
      {selectedPractitionerId && (
        filteredSchedules.length === 0 ? (
          <div className={styles.empty}>
            Keine individuellen Sprechzeiten hinterlegt. Es gelten die Standard-Praxisöffnungszeiten.
          </div>
        ) : (
          <>
          <div className={styles.weekOverview}>
            {DISPLAY_ORDER.map((dayNum) => {
              const daySchedules = schedulesByDay.get(dayNum) || [];
              return (
                <div key={dayNum} className={styles.daySection}>
                  <div className={styles.dayHeader}>{JS_DAY_NAMES[dayNum]}</div>
                  {daySchedules.length === 0 ? (
                    <div className={styles.dayEmpty}>Kein Eintrag</div>
                  ) : (
                    <div className={styles.daySlots}>
                      {daySchedules.map((entry) => (
                        <div
                          key={entry.id}
                          className={`${styles.scheduleCard} ${getCardClass(entry)}`}
                        >
                          <div className={styles.cardContent}>
                            <span className={styles.cardTime}>
                              {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                            </span>
                            {entry.label && (
                              <span className={styles.cardLabel}>{entry.label}</span>
                            )}
                            <span className={styles.cardBadge}>{getCardBadge(entry)}</span>
                          </div>
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDelete(entry.id)}
                            title="Eintrag löschen"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Geplante Einzel-Schichten (Schichtplan-Datum) */}
          {singleShifts.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{
                fontSize: '0.875rem', fontWeight: 600, color: '#374151',
                margin: '0 0 0.75rem 0',
              }}>
                Geplante Einzel-Schichten
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {singleShifts.map((entry) => {
                  const d = new Date((entry.valid_from || '') + 'T00:00:00');
                  const dateLabel = d.toLocaleDateString('de-DE', {
                    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
                  });
                  return (
                    <div
                      key={entry.id}
                      className={`${styles.scheduleCard} ${getCardClass(entry)}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <div className={styles.cardContent} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{dateLabel}</span>
                        <span className={styles.cardTime}>
                          {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                        </span>
                        {entry.label && (
                          <span className={styles.cardLabel}>{entry.label}</span>
                        )}
                        <span className={styles.cardBadge}>{getCardBadge(entry)}</span>
                      </div>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDelete(entry.id)}
                        title="Einzel-Schicht löschen"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
        )
      )}
    </div>
  );
}
