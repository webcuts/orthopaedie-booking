import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import styles from './DataImportPage.module.css';

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  treatmentType: string;
  practitioner: string;
  status: string;
}

interface PreviewData {
  rows: CsvRow[];
  columns: string[];
  mapping: ColumnMapping;
  totalRows: number;
  futureRows: number;
  pastRows: number;
  practitioners: string[];
  problems: string[];
}

interface ImportResult {
  imported: number;
  skippedPast: number;
  skippedDuplicate: number;
  skippedError: number;
  errors: string[];
}

const DEFAULT_MAPPING: ColumnMapping = {
  patientName: '',
  patientEmail: '',
  patientPhone: '',
  date: '',
  startTime: '',
  endTime: '',
  treatmentType: '',
  practitioner: '',
  status: '',
};

// Common Doctolib CSV column names (German/English)
const COLUMN_HINTS: Record<keyof ColumnMapping, string[]> = {
  patientName: ['patient', 'name', 'patientenname', 'nachname', 'vorname', 'patient name', 'nom'],
  patientEmail: ['email', 'e-mail', 'mail', 'e-mail-adresse', 'email address'],
  patientPhone: ['telefon', 'phone', 'tel', 'mobiltelefon', 'handy', 'telefonnummer', 'mobile'],
  date: ['datum', 'date', 'termin', 'appointment date', 'tag'],
  startTime: ['uhrzeit', 'zeit', 'start', 'time', 'beginn', 'start time', 'heure'],
  endTime: ['ende', 'end', 'end time', 'bis'],
  treatmentType: ['terminart', 'behandlung', 'leistung', 'treatment', 'motif', 'reason', 'type', 'art'],
  practitioner: ['arzt', 'behandler', 'doctor', 'practitioner', 'praticien', 'dr'],
  status: ['status', 'state', 'statut'],
};

function autoMapColumns(columns: string[]): ColumnMapping {
  const mapping = { ...DEFAULT_MAPPING };
  const lowerCols = columns.map(c => c.toLowerCase().trim());

  for (const [field, hints] of Object.entries(COLUMN_HINTS)) {
    for (const hint of hints) {
      const idx = lowerCols.findIndex(c => c.includes(hint));
      if (idx !== -1 && !Object.values(mapping).includes(columns[idx])) {
        (mapping as any)[field] = columns[idx];
        break;
      }
    }
  }

  return mapping;
}

function parseCsv(text: string): { rows: CsvRow[]; columns: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], columns: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const columns = parseCsvLine(lines[0], delimiter);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (values.length === 0) continue;
    const row: CsvRow = {};
    columns.forEach((col, idx) => {
      row[col] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return { rows, columns };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string): string | null {
  // Try common formats: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
  let match = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return dateStr;
  return null;
}

function parseTime(timeStr: string): string | null {
  const match = timeStr.match(/^(\d{1,2})[.:h](\d{2})(?::(\d{2}))?/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}:00`;
  }
  return null;
}

export function DataImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { rows, columns } = parseCsv(text);

        if (rows.length === 0) {
          setError('Die CSV-Datei enthält keine Daten.');
          return;
        }

        const autoMapping = autoMapColumns(columns);
        setMapping(autoMapping);

        const today = new Date().toISOString().split('T')[0];
        const practitioners = new Set<string>();
        const problems: string[] = [];
        let futureRows = 0;
        let pastRows = 0;

        rows.forEach((row, idx) => {
          const dateVal = autoMapping.date ? row[autoMapping.date] : '';
          const parsed = dateVal ? parseDate(dateVal) : null;
          if (!parsed) {
            if (autoMapping.date) problems.push(`Zeile ${idx + 2}: Ungültiges Datum "${dateVal}"`);
          } else if (parsed >= today) {
            futureRows++;
          } else {
            pastRows++;
          }

          const pract = autoMapping.practitioner ? row[autoMapping.practitioner] : '';
          if (pract) practitioners.add(pract);
        });

        if (!autoMapping.date) problems.push('Spalte für Datum konnte nicht automatisch erkannt werden.');
        if (!autoMapping.patientName) problems.push('Spalte für Patientenname konnte nicht automatisch erkannt werden.');
        if (!autoMapping.startTime) problems.push('Spalte für Uhrzeit konnte nicht automatisch erkannt werden.');

        setPreview({
          rows,
          columns,
          mapping: autoMapping,
          totalRows: rows.length,
          futureRows,
          pastRows,
          practitioners: Array.from(practitioners),
          problems: problems.slice(0, 10),
        });
        setStep('preview');
      } catch {
        setError('Fehler beim Lesen der CSV-Datei.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const handleImport = async () => {
    if (!preview) return;
    setStep('importing');
    setError(null);

    const result: ImportResult = {
      imported: 0,
      skippedPast: 0,
      skippedDuplicate: 0,
      skippedError: 0,
      errors: [],
    };

    try {
      // Load practitioners for matching
      const { data: practitioners } = await supabase
        .from('practitioners')
        .select('id, first_name, last_name, title')
        .eq('is_active', true);

      // Load existing patients for dedup
      const { data: existingPatients } = await supabase
        .from('patients')
        .select('id, name, phone');

      const today = new Date().toISOString().split('T')[0];

      for (const row of preview.rows) {
        try {
          // Parse date
          const dateStr = mapping.date ? row[mapping.date] : '';
          const parsedDate = parseDate(dateStr);
          if (!parsedDate) {
            result.skippedError++;
            continue;
          }

          // Skip past appointments
          if (parsedDate < today) {
            result.skippedPast++;
            continue;
          }

          // Parse time
          const timeStr = mapping.startTime ? row[mapping.startTime] : '';
          const parsedTime = parseTime(timeStr);
          if (!parsedTime) {
            result.skippedError++;
            result.errors.push(`Ungültige Uhrzeit: "${timeStr}"`);
            continue;
          }

          const endTimeStr = mapping.endTime ? row[mapping.endTime] : '';
          const parsedEndTime = parseTime(endTimeStr);

          // Patient data
          const patientName = mapping.patientName ? row[mapping.patientName] : '';
          const patientEmail = mapping.patientEmail ? row[mapping.patientEmail] : '';
          const patientPhone = mapping.patientPhone ? row[mapping.patientPhone] : '';

          if (!patientName.trim()) {
            result.skippedError++;
            continue;
          }

          // Match practitioner
          const practName = mapping.practitioner ? row[mapping.practitioner]?.toLowerCase() : '';
          let practitionerId: string | null = null;
          if (practName && practitioners) {
            const match = practitioners.find(p => {
              const fullName = `${p.title || ''} ${p.first_name} ${p.last_name}`.toLowerCase().trim();
              return fullName.includes(practName) || practName.includes(p.last_name.toLowerCase());
            });
            if (match) practitionerId = match.id;
          }

          // Check for duplicate: same patient name + phone + date + time
          const { data: existingAppointments } = await supabase
            .from('appointments')
            .select('id, patient:patients(name, phone), time_slot:time_slots(date, start_time)')
            .eq('time_slot.date', parsedDate)
            .eq('time_slot.start_time', parsedTime);

          const isDuplicate = existingAppointments?.some(apt => {
            const p = (apt as any).patient;
            const ts = (apt as any).time_slot;
            return p?.name?.toLowerCase() === patientName.toLowerCase().trim()
              && ts?.date === parsedDate
              && ts?.start_time === parsedTime;
          });

          if (isDuplicate) {
            result.skippedDuplicate++;
            continue;
          }

          // Find or create patient
          let patientId: string | null = null;
          const existingPatient = existingPatients?.find(p =>
            p.name.toLowerCase() === patientName.toLowerCase().trim()
            && patientPhone && p.phone === patientPhone.trim()
          );

          if (existingPatient) {
            patientId = existingPatient.id;
          } else {
            // Get default insurance type
            const { data: defaultInsurance } = await supabase
              .from('insurance_types')
              .select('id')
              .limit(1)
              .single();

            const { data: newPatient, error: patientError } = await supabase
              .from('patients')
              .insert({
                name: patientName.trim(),
                email: patientEmail.trim() || null,
                phone: patientPhone.trim() || '000000',
                insurance_type_id: defaultInsurance?.id,
              })
              .select('id')
              .single();

            if (patientError || !newPatient) {
              result.skippedError++;
              result.errors.push(`Patient "${patientName}" konnte nicht angelegt werden`);
              continue;
            }
            patientId = newPatient.id;
          }

          // Find or create time slot
          let timeSlotId: string | null = null;
          const endTime = parsedEndTime || incrementTime(parsedTime, 15);

          const { data: existingSlot } = await supabase
            .from('time_slots')
            .select('id')
            .eq('date', parsedDate)
            .eq('start_time', parsedTime)
            .eq('is_available', true)
            .maybeSingle();

          if (existingSlot) {
            timeSlotId = existingSlot.id;
            // Block the slot
            await supabase
              .from('time_slots')
              .update({ is_available: false })
              .eq('id', existingSlot.id);
          } else {
            // Check if slot exists but is blocked
            const { data: blockedSlot } = await supabase
              .from('time_slots')
              .select('id')
              .eq('date', parsedDate)
              .eq('start_time', parsedTime)
              .maybeSingle();

            if (blockedSlot) {
              // Slot exists but already blocked – skip as duplicate
              result.skippedDuplicate++;
              continue;
            }

            // Create a new slot (blocked)
            const { data: newSlot, error: slotError } = await supabase
              .from('time_slots')
              .insert({
                date: parsedDate,
                start_time: parsedTime,
                end_time: endTime,
                is_available: false,
                practitioner_id: practitionerId,
              })
              .select('id')
              .single();

            if (slotError || !newSlot) {
              result.skippedError++;
              result.errors.push(`Zeitslot für ${parsedDate} ${parsedTime} konnte nicht erstellt werden`);
              continue;
            }
            timeSlotId = newSlot.id;
          }

          // Get treatment type
          const treatmentName = mapping.treatmentType ? row[mapping.treatmentType] : '';
          let treatmentTypeId: string | null = null;

          if (treatmentName) {
            const { data: tt } = await supabase
              .from('treatment_types')
              .select('id')
              .ilike('name', `%${treatmentName.trim()}%`)
              .maybeSingle();
            treatmentTypeId = tt?.id || null;
          }

          // Fallback: first active treatment type
          if (!treatmentTypeId) {
            const { data: defaultTt } = await supabase
              .from('treatment_types')
              .select('id')
              .eq('is_active', true)
              .limit(1)
              .single();
            treatmentTypeId = defaultTt?.id || null;
          }

          if (!treatmentTypeId) {
            result.skippedError++;
            result.errors.push('Keine Terminart gefunden');
            continue;
          }

          // Create appointment
          const { error: appointmentError } = await supabase
            .from('appointments')
            .insert({
              patient_id: patientId,
              time_slot_id: timeSlotId,
              treatment_type_id: treatmentTypeId,
              practitioner_id: practitionerId,
              status: 'confirmed',
              language: 'de',
            });

          if (appointmentError) {
            result.skippedError++;
            result.errors.push(`Termin für "${patientName}" am ${parsedDate}: ${appointmentError.message}`);
          } else {
            result.imported++;
          }
        } catch (rowError) {
          result.skippedError++;
        }
      }

      setImportResult(result);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setMapping(DEFAULT_MAPPING);
    setImportResult(null);
    setError(null);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Datenimport</h1>
      <p className={styles.subtitle}>Doctolib-Termine als CSV importieren</p>

      {error && (
        <div className={styles.error}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className={styles.uploadSection}>
          <div className={styles.uploadBox}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className={styles.uploadText}>CSV-Datei aus Doctolib hier hochladen</p>
            <p className={styles.uploadHint}>Unterstützt: CSV mit Komma- oder Semikolon-Trennung</p>
            <label className={styles.uploadButton}>
              Datei auswählen
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className={styles.previewSection}>
          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{preview.totalRows}</span>
              <span className={styles.statLabel}>Termine gesamt</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: '#22C55E' }}>{preview.futureRows}</span>
              <span className={styles.statLabel}>Zukünftige Termine</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: '#9CA3AF' }}>{preview.pastRows}</span>
              <span className={styles.statLabel}>Vergangene (werden übersprungen)</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{preview.practitioners.length}</span>
              <span className={styles.statLabel}>Behandler erkannt</span>
            </div>
          </div>

          {/* Practitioners */}
          {preview.practitioners.length > 0 && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Erkannte Behandler</h3>
              <div className={styles.tagList}>
                {preview.practitioners.map(p => (
                  <span key={p} className={styles.tag}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Problems */}
          {preview.problems.length > 0 && (
            <div className={styles.warningCard}>
              <h3 className={styles.cardTitle}>Hinweise</h3>
              <ul className={styles.problemList}>
                {preview.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Column Mapping */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Spaltenzuordnung</h3>
            <p className={styles.cardHint}>Prüfe und korrigiere die automatische Zuordnung bei Bedarf.</p>
            <div className={styles.mappingGrid}>
              {(Object.entries({
                patientName: 'Patientenname *',
                patientEmail: 'E-Mail',
                patientPhone: 'Telefon',
                date: 'Datum *',
                startTime: 'Uhrzeit *',
                endTime: 'Ende',
                treatmentType: 'Terminart',
                practitioner: 'Behandler',
                status: 'Status',
              }) as [keyof ColumnMapping, string][]).map(([field, label]) => (
                <div key={field} className={styles.mappingRow}>
                  <label className={styles.mappingLabel}>{label}</label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className={styles.mappingSelect}
                  >
                    <option value="">— nicht zugeordnet —</option>
                    {preview.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data Preview */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Vorschau (erste 5 Zeilen)</h3>
            <div className={styles.tableWrapper}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    {preview.columns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map(col => (
                        <td key={col}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={reset}>
              Abbrechen
            </button>
            <button
              className={styles.primaryButton}
              onClick={handleImport}
              disabled={!mapping.patientName || !mapping.date || !mapping.startTime}
            >
              {preview.futureRows} Termine importieren
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className={styles.importingSection}>
          <div className={styles.spinner} />
          <p>Import läuft... Bitte warten.</p>
        </div>
      )}

      {step === 'done' && importResult && (
        <div className={styles.resultSection}>
          <div className={styles.resultIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className={styles.resultTitle}>Import abgeschlossen</h2>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: '#22C55E' }}>{importResult.imported}</span>
              <span className={styles.statLabel}>Importiert</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: '#9CA3AF' }}>{importResult.skippedPast}</span>
              <span className={styles.statLabel}>Vergangene übersprungen</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: '#F59E0B' }}>{importResult.skippedDuplicate}</span>
              <span className={styles.statLabel}>Duplikate übersprungen</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: '#DC3545' }}>{importResult.skippedError}</span>
              <span className={styles.statLabel}>Fehler</span>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className={styles.warningCard}>
              <h3 className={styles.cardTitle}>Fehlerdetails</h3>
              <ul className={styles.problemList}>
                {importResult.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {importResult.errors.length > 20 && (
                  <li>... und {importResult.errors.length - 20} weitere</li>
                )}
              </ul>
            </div>
          )}

          <button className={styles.primaryButton} onClick={reset}>
            Neuen Import starten
          </button>
        </div>
      )}
    </div>
  );
}

function incrementTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`;
}
