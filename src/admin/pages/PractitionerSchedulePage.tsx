import { PractitionerScheduleManager } from '../components';
import styles from './PractitionerSchedulePage.module.css';

export function PractitionerSchedulePage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Dienstplan Ärzte</h1>

      <div className={styles.sections}>
        <PractitionerScheduleManager />
      </div>
    </div>
  );
}
