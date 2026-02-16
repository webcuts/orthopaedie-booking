import { SlotGenerator, TreatmentTypes, MfaTreatmentTypes, AbsenceManager, PractitionerScheduleManager } from '../components';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Einstellungen</h1>

      <div className={styles.sections}>
        <AbsenceManager />
        <PractitionerScheduleManager />
        <SlotGenerator />
        <TreatmentTypes />
        <MfaTreatmentTypes />
      </div>
    </div>
  );
}
