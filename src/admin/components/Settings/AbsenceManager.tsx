import { useState, FormEvent } from 'react';
import { usePractitionerAbsences } from '../../hooks';
import styles from './AbsenceManager.module.css';

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

export function AbsenceManager() {
  const {
    absences,
    practitioners,
    loading,
    error,
    createAbsence,
    deleteAbsence,
  } = usePractitionerAbsences();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [practitionerId, setPractitionerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState<'sick' | 'vacation' | 'other'>('vacation');
  const [note, setNote] = useState('');

  const resetForm = () => {
    setPractitionerId('');
    setStartDate('');
    setEndDate('');
    setReason('vacation');
    setNote('');
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

    setSaving(true);
    const result = await createAbsence({
      practitioner_id: practitionerId,
      start_date: startDate,
      end_date: endDate,
      reason,
      note: note || undefined,
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
    if (!confirm('Abwesenheit wirklich löschen?')) return;
    await deleteAbsence(id);
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
                min={new Date().toISOString().split('T')[0]}
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
                min={startDate || new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

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
                </div>
                {absence.note && (
                  <div className={styles.absenceNote}>{absence.note}</div>
                )}
              </div>
              <button
                className={styles.deleteButton}
                onClick={() => handleDelete(absence.id)}
                title="Abwesenheit löschen"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
