import { useState, useMemo, FormEvent } from 'react';
import { usePractitionerSchedulesAdmin } from '../../hooks';
import type { PractitionerScheduleEntry } from '../../hooks';
import styles from './PractitionerScheduleManager.module.css';

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
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBookable, setIsBookable] = useState(true);
  const [insuranceFilter, setInsuranceFilter] = useState<'all' | 'private_only'>('all');
  const [label, setLabel] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');

  const filteredSchedules = useMemo(() => {
    if (!selectedPractitionerId) return [];
    return schedules.filter(s => s.practitioner_id === selectedPractitionerId);
  }, [schedules, selectedPractitionerId]);

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, PractitionerScheduleEntry[]>();
    for (const s of filteredSchedules) {
      const existing = map.get(s.day_of_week) || [];
      existing.push(s);
      map.set(s.day_of_week, existing);
    }
    return map;
  }, [filteredSchedules]);

  const resetForm = () => {
    setDayOfWeek(1);
    setStartTime('');
    setEndTime('');
    setIsBookable(true);
    setInsuranceFilter('all');
    setLabel('');
    setValidFrom(new Date().toISOString().split('T')[0]);
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

    setSaving(true);
    const result = await createSchedule({
      practitioner_id: selectedPractitionerId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_bookable: isBookable,
      insurance_filter: insuranceFilter,
      label: label || undefined,
      valid_from: validFrom,
      valid_until: validUntil || null,
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

          <div className={styles.formRow3}>
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

            <div className={styles.field}>
              <label htmlFor="schedule-valid-from">Gültig ab</label>
              <input
                type="date"
                id="schedule-valid-from"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
          </div>

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
        )
      )}
    </div>
  );
}
