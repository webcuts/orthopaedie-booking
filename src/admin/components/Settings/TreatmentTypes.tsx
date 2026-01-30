import { useState } from 'react';
import { useTreatmentTypes } from '../../hooks';
import type { TreatmentType } from '../../../types/database';
import styles from './TreatmentTypes.module.css';

interface EditingType {
  id?: string;
  name: string;
  duration_minutes: number;
  description: string;
}

export function TreatmentTypes() {
  const {
    treatmentTypes,
    loading,
    error,
    createTreatmentType,
    updateTreatmentType,
  } = useTreatmentTypes();

  const [editing, setEditing] = useState<EditingType | null>(null);
  const [saving, setSaving] = useState(false);

  const handleEdit = (type: TreatmentType) => {
    setEditing({
      id: type.id,
      name: type.name,
      duration_minutes: type.duration_minutes,
      description: type.description || '',
    });
  };

  const handleNew = () => {
    setEditing({
      name: '',
      duration_minutes: 10,
      description: '',
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;

    setSaving(true);

    if (editing.id) {
      await updateTreatmentType(editing.id, {
        name: editing.name,
        duration_minutes: editing.duration_minutes,
        description: editing.description || undefined,
      });
    } else {
      await createTreatmentType({
        name: editing.name,
        duration_minutes: editing.duration_minutes,
        description: editing.description || undefined,
      });
    }

    setSaving(false);
    setEditing(null);
  };

  const handleToggleActive = async (type: TreatmentType) => {
    await updateTreatmentType(type.id, { is_active: !type.is_active });
  };

  const handleCancel = () => {
    setEditing(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Behandlungsarten</h3>
          <p className={styles.description}>
            Verwalte die verfügbaren Terminarten für Patienten.
          </p>
        </div>
        <button onClick={handleNew} className={styles.addButton}>
          + Neue Behandlungsart
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Lade...</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Dauer</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {treatmentTypes.map((type) => (
              <tr key={type.id} className={!type.is_active ? styles.inactive : ''}>
                <td>
                  <div className={styles.typeName}>{type.name}</div>
                  {type.description && (
                    <div className={styles.typeDescription}>{type.description}</div>
                  )}
                </td>
                <td>{type.duration_minutes} Min.</td>
                <td>
                  <button
                    onClick={() => handleToggleActive(type)}
                    className={`${styles.statusToggle} ${
                      type.is_active ? styles.active : ''
                    }`}
                  >
                    {type.is_active ? 'Aktiv' : 'Inaktiv'}
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => handleEdit(type)}
                    className={styles.editButton}
                  >
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className={styles.modalOverlay} onClick={handleCancel}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 className={styles.modalTitle}>
              {editing.id ? 'Behandlungsart bearbeiten' : 'Neue Behandlungsart'}
            </h4>

            <div className={styles.formField}>
              <label>Name</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="z.B. Erstuntersuchung"
              />
            </div>

            <div className={styles.formField}>
              <label>Dauer (Minuten)</label>
              <select
                value={editing.duration_minutes}
                onChange={(e) =>
                  setEditing({ ...editing, duration_minutes: Number(e.target.value) })
                }
              >
                <option value={5}>5 Minuten</option>
                <option value={10}>10 Minuten</option>
                <option value={15}>15 Minuten</option>
                <option value={20}>20 Minuten</option>
                <option value={30}>30 Minuten</option>
                <option value={45}>45 Minuten</option>
                <option value={60}>60 Minuten</option>
              </select>
            </div>

            <div className={styles.formField}>
              <label>Beschreibung (optional)</label>
              <textarea
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                placeholder="Kurze Beschreibung der Behandlungsart"
                rows={3}
              />
            </div>

            <div className={styles.modalActions}>
              <button onClick={handleCancel} className={styles.cancelButton}>
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.name.trim()}
                className={styles.saveButton}
              >
                {saving ? 'Speichere...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
