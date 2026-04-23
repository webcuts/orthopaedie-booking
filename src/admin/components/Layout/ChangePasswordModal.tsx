import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import styles from './ChangePasswordModal.module.css';

interface ChangePasswordModalProps {
  userEmail: string;
  onClose: () => void;
}

const MIN_LENGTH = 8;

export function ChangePasswordModal({ userEmail, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!currentPassword) next.current = 'Bitte aktuelles Passwort eingeben';
    if (!newPassword) next.new = 'Bitte neues Passwort eingeben';
    else if (newPassword.length < MIN_LENGTH) next.new = `Mindestens ${MIN_LENGTH} Zeichen`;
    else if (newPassword === currentPassword) next.new = 'Neues Passwort muss sich unterscheiden';
    if (newPassword !== confirmPassword) next.confirm = 'Passwörter stimmen nicht überein';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setGeneralError(null);
    if (!validate()) return;
    setLoading(true);

    try {
      // 1. Aktuelles Passwort verifizieren via Re-Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (authError) {
        setErrors((prev) => ({ ...prev, current: 'Aktuelles Passwort ist falsch' }));
        return;
      }

      // 2. Neues Passwort setzen
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setGeneralError(updateError.message);
        return;
      }

      setSuccess(true);
      // Nach 2 Sekunden schließen
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Fehler beim Ändern');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h2 className={styles.title}>Passwort geändert</h2>
          </div>
          <div className={styles.content}>
            <div className={styles.success}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Ihr Passwort wurde erfolgreich geändert. Bitte beim nächsten Login mit dem neuen Passwort anmelden.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Passwort ändern</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Schließen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {generalError && <div className={styles.error}>{generalError}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label}>Aktuelles Passwort</label>
            <input
              type="password"
              className={`${styles.input} ${errors.current ? styles.inputError : ''}`}
              value={currentPassword}
              autoComplete="current-password"
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setErrors((prev) => ({ ...prev, current: '' }));
              }}
            />
            {errors.current && <div className={styles.errorText}>{errors.current}</div>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Neues Passwort</label>
            <input
              type="password"
              className={`${styles.input} ${errors.new ? styles.inputError : ''}`}
              value={newPassword}
              autoComplete="new-password"
              onChange={(e) => {
                setNewPassword(e.target.value);
                setErrors((prev) => ({ ...prev, new: '' }));
              }}
            />
            <div className={styles.hint}>Mindestens {MIN_LENGTH} Zeichen</div>
            {errors.new && <div className={styles.errorText}>{errors.new}</div>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Neues Passwort wiederholen</label>
            <input
              type="password"
              className={`${styles.input} ${errors.confirm ? styles.inputError : ''}`}
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirm: '' }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
            {errors.confirm && <div className={styles.errorText}>{errors.confirm}</div>}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose} disabled={loading}>
            Abbrechen
          </button>
          <button className={styles.submitButton} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Wird geändert...' : 'Passwort ändern'}
          </button>
        </div>
      </div>
    </div>
  );
}
