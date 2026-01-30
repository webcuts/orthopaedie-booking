import { useState } from 'react';
import { useGenerateSlots } from '../../hooks';
import styles from './SlotGenerator.module.css';

export function SlotGenerator() {
  const [weeksAhead, setWeeksAhead] = useState(4);
  const { generateSlots, loading, result, error } = useGenerateSlots();

  const handleGenerate = async () => {
    await generateSlots(weeksAhead);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Zeitslots generieren</h3>
      <p className={styles.description}>
        Generiere automatisch Zeitslots basierend auf den Öffnungszeiten der Praxis.
      </p>

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="weeks" className={styles.label}>
            Wochen im Voraus
          </label>
          <select
            id="weeks"
            value={weeksAhead}
            onChange={(e) => setWeeksAhead(Number(e.target.value))}
            className={styles.select}
            disabled={loading}
          >
            <option value={1}>1 Woche</option>
            <option value={2}>2 Wochen</option>
            <option value={4}>4 Wochen</option>
            <option value={8}>8 Wochen</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Generiere...' : 'Slots generieren'}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {result && (
        <div className={styles.success}>
          <strong>{result.slots_created}</strong> Slots wurden für den Zeitraum{' '}
          <strong>{result.period}</strong> generiert.
        </div>
      )}
    </div>
  );
}
