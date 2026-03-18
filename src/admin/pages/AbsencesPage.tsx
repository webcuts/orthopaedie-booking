import { AbsenceManager } from '../components';
import styles from './SettingsPage.module.css';

export function AbsencesPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Abwesenheiten</h1>

      <div className={styles.sections}>
        <AbsenceManager />
      </div>
    </div>
  );
}
