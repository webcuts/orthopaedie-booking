import { SlotGenerator, TreatmentTypes, MfaTreatmentTypes, AbsenceManager } from '../components';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Einstellungen</h1>

      <div className={styles.sections}>
        <AbsenceManager />
        <SlotGenerator />
        <TreatmentTypes />
        <MfaTreatmentTypes />
      </div>
    </div>
  );
}
