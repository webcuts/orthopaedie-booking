import { useState } from 'react';
import { useMfaTreatmentTypesAdmin } from '../../hooks';
import { useSpecialties } from '../../../hooks/useSupabase';
import type { MfaTreatmentType } from '../../../types/database';
import styles from './TreatmentTypes.module.css';

interface EditingType {
  id?: string;
  name: string;
  name_en: string;
  name_tr: string;
  duration_minutes: number;
  specialty_id: string;
}

export function MfaTreatmentTypes() {
  const {
    treatmentTypes,
    loading,
    error,
    createType,
    updateType,
  } = useMfaTreatmentTypesAdmin();
  const { data: specialties } = useSpecialties();

  const [editing, setEditing] = useState<EditingType | null>(null);
  const [saving, setSaving] = useState(false);

  const getSpecialtyName = (specialtyId?: string | null) => {
    if (!specialtyId) return 'Alle Fachgebiete';
    return specialties.find(s => s.id === specialtyId)?.name || '—';
  };

  const handleEdit = (type: MfaTreatmentType) => {
    setEditing({
      id: type.id,
      name: type.name,
      name_en: type.name_en || '',
      name_tr: type.name_tr || '',
      duration_minutes: type.duration_minutes,
      specialty_id: type.specialty_id || '',
    });
  };

  const handleNew = () => {
    setEditing({
      name: '',
      name_en: '',
      name_tr: '',
      duration_minutes: 10,
      specialty_id: '',
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;

    setSaving(true);

    if (editing.id) {
      await updateType(editing.id, {
        name: editing.name,
        name_en: editing.name_en || null,
        name_tr: editing.name_tr || null,
        duration_minutes: editing.duration_minutes,
        specialty_id: editing.specialty_id || null,
      });
    } else {
      await createType({
        name: editing.name,
        name_en: editing.name_en || undefined,
        name_tr: editing.name_tr || undefined,
        duration_minutes: editing.duration_minutes,
        specialty_id: editing.specialty_id || null,
      });
    }

    setSaving(false);
    setEditing(null);
  };

  const handleToggleActive = async (type: MfaTreatmentType) => {
    await updateType(type.id, { is_active: !type.is_active });
  };

  const handleCancel = () => {
    setEditing(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>MFA-Leistungen</h3>
          <p className={styles.description}>
            Verwalte die verfügbaren Praxisleistungen (ohne Arzt) für Patienten.
          </p>
        </div>
        <button onClick={handleNew} className={styles.addButton}>
          + Neue MFA-Leistung
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Lade...</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name (DE / EN / TR)</th>
              <th>Fachgebiet</th>
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
                  {(type.name_en || type.name_tr) && (
                    <div className={styles.typeDescription}>
                      {type.name_en && `EN: ${type.name_en}`}
                      {type.name_en && type.name_tr && ' | '}
                      {type.name_tr && `TR: ${type.name_tr}`}
                    </div>
                  )}
                </td>
                <td>
                  <div className={styles.typeDescription}>{getSpecialtyName(type.specialty_id)}</div>
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
              {editing.id ? 'MFA-Leistung bearbeiten' : 'Neue MFA-Leistung'}
            </h4>

            <div className={styles.formField}>
              <label>Name (Deutsch)</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="z.B. Rezeptvergabe"
              />
            </div>

            <div className={styles.formField}>
              <label>Name (Englisch)</label>
              <input
                type="text"
                value={editing.name_en}
                onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                placeholder="z.B. Prescription"
              />
            </div>

            <div className={styles.formField}>
              <label>Name (Türkisch)</label>
              <input
                type="text"
                value={editing.name_tr}
                onChange={(e) => setEditing({ ...editing, name_tr: e.target.value })}
                placeholder="z.B. Reçete"
              />
            </div>

            <div className={styles.formField}>
              <label>Fachgebiet (optional)</label>
              <select
                value={editing.specialty_id}
                onChange={(e) =>
                  setEditing({ ...editing, specialty_id: e.target.value })
                }
              >
                <option value="">Alle Fachgebiete</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
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
              </select>
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
