import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import styles from './PatientSearch.module.css';

export interface PatientMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  insurance_type_id: string;
}

interface PatientSearchProps {
  onSelect: (patient: PatientMatch | null) => void;
  selectedPatientId: string | null;
  selectedPatientLabel: string | null;
}

const DOCTOLIB_PHONE_PREFIX = '999';

function isDoctolibPlaceholder(phone: string | null | undefined): boolean {
  return !!phone && phone.startsWith(DOCTOLIB_PHONE_PREFIX) && phone.length <= 12;
}

export function PatientSearch({ onSelect, selectedPatientId, selectedPatientLabel }: PatientSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (selectedPatientId) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('patients')
          .select('id, name, email, phone, insurance_type_id')
          .ilike('name', `%${trimmed}%`)
          .order('name')
          .limit(20);
        setResults(data || []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, selectedPatientId]);

  const handleSelect = (patient: PatientMatch) => {
    onSelect(patient);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  if (selectedPatientId) {
    return (
      <div className={styles.container}>
        <div className={styles.selectedBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Bestehender Patient: <strong>{selectedPatientLabel}</strong>
        </div>
        <button type="button" className={styles.clearButton} onClick={handleClear}>
          Anderen Patienten suchen / Neu anlegen
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Bestehenden Patienten suchen (Name, min. 2 Zeichen)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className={styles.dropdown}>
          {loading ? (
            <div className={styles.loading}>Suche...</div>
          ) : results.length === 0 ? (
            <div className={styles.noResults}>
              Kein Patient gefunden. Bitte Daten unten neu eingeben.
            </div>
          ) : (
            results.map((p) => {
              const doctolib = isDoctolibPlaceholder(p.phone);
              const phoneDisplay = doctolib ? '—' : p.phone;
              const meta = [phoneDisplay, p.email].filter(Boolean).join(' · ');
              return (
                <div
                  key={p.id}
                  className={styles.result}
                  onClick={() => handleSelect(p)}
                >
                  <div className={styles.resultName}>
                    {p.name}
                    {doctolib && <span className={styles.doctolibBadge}>Doctolib-Import</span>}
                  </div>
                  {meta && <div className={styles.resultMeta}>{meta}</div>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export { isDoctolibPlaceholder };
