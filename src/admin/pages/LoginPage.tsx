import { useState, useEffect, useRef, FormEvent } from 'react';
import { useAuth } from '../hooks';
import styles from './LoginPage.module.css';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLocked = countdown > 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startLockout = () => {
    setCountdown(LOCKOUT_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isLocked) return;

    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben');
      return;
    }

    const result = await login({ email, password });
    if (result.error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setError(`Zu viele Fehlversuche. Bitte warten Sie ${LOCKOUT_SECONDS} Sekunden.`);
        startLockout();
      } else {
        setError(result.error);
      }
    }
  };

  const getButtonText = () => {
    if (loading) return 'Anmelden...';
    if (isLocked) return `Gesperrt (${countdown}s)`;
    return 'Anmelden';
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logo}>
          <h1>Orthopädie</h1>
          <span>Königstraße</span>
        </div>

        <h2 className={styles.title}>Admin-Login</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email">E-Mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="praxis@example.de"
              autoComplete="email"
              disabled={loading || isLocked}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading || isLocked}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading || isLocked}
          >
            {getButtonText()}
          </button>
        </form>
      </div>
    </div>
  );
}
