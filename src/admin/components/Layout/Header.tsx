import { useAuth } from '../../hooks';
import styles from './Header.module.css';

export function Header() {
  const { user, logout } = useAuth();

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className={styles.header}>
      <div className={styles.date}>
        {today}
      </div>

      <div className={styles.user}>
        <span className={styles.email}>{user?.email}</span>
        <button onClick={logout} className={styles.logoutButton}>
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Abmelden</span>
        </button>
      </div>
    </header>
  );
}
