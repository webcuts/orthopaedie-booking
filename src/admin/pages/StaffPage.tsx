import { useState, useEffect, useCallback, FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../hooks';
import styles from './StaffPage.module.css';

interface StaffMember {
  id: string;
  display_name: string;
  role: 'admin' | 'mfa';
  is_active: boolean;
  created_at: string;
  email?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  mfa: 'MFA',
};

export function StaffPage() {
  const { isAdmin, session } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'mfa'>('mfa');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch emails from auth metadata (not directly accessible, use display info)
      setStaff(data as StaffMember[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Mitarbeiter</h1>
        <p className={styles.noAccess}>Nur Administratoren haben Zugriff auf die Mitarbeiterverwaltung.</p>
      </div>
    );
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError('Bitte alle Felder ausfüllen');
      return;
    }

    if (newPassword.length < 6) {
      setFormError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setSaving(true);

    try {
      const response = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'create',
          email: newEmail.trim(),
          password: newPassword,
          displayName: newName.trim(),
          role: newRole,
        },
      });

      if (response.error || !response.data?.success) {
        setFormError(response.data?.error || response.error?.message || 'Fehler beim Erstellen');
        return;
      }

      setShowForm(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('mfa');
      fetchStaff();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (userId: string) => {
    await supabase.functions.invoke('manage-staff', {
      body: { action: 'archive', userId },
    });
    fetchStaff();
  };

  const handleReactivate = async (userId: string) => {
    await supabase.functions.invoke('manage-staff', {
      body: { action: 'reactivate', userId },
    });
    fetchStaff();
  };

  const activeStaff = staff.filter(s => s.is_active);
  const archivedStaff = staff.filter(s => !s.is_active);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Mitarbeiter</h1>
        <button className={styles.addButton} onClick={() => setShowForm(true)}>
          + Neuen Mitarbeiter anlegen
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Neuen Mitarbeiter anlegen</h3>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={styles.formInput}
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>E-Mail *</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={styles.formInput}
                placeholder="email@beispiel.de"
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Passwort *</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={styles.formInput}
                placeholder="Initiales Passwort"
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Rolle *</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'mfa')}
                className={styles.formInput}
              >
                <option value="mfa">MFA (Kalender, Termine, Vorbestellungen)</option>
                <option value="admin">Admin (Vollzugriff inkl. Mitarbeiterverwaltung)</option>
              </select>
            </div>

            {formError && <div className={styles.formError}>{formError}</div>}

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setShowForm(false)}>
                Abbrechen
              </button>
              <button type="submit" className={styles.submitButton} disabled={saving}>
                {saving ? 'Wird erstellt...' : 'Mitarbeiter erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Staff List */}
      {loading ? (
        <div className={styles.loading}>Lade Mitarbeiter...</div>
      ) : (
        <div className={styles.list}>
          <h3 className={styles.sectionTitle}>Aktiv ({activeStaff.length})</h3>
          {activeStaff.map(member => (
            <div key={member.id} className={styles.staffCard}>
              <div className={styles.staffInfo}>
                <div className={styles.staffName}>{member.display_name}</div>
                <span
                  className={styles.roleBadge}
                  style={{
                    background: member.role === 'admin' ? '#DBEAFE' : '#F3E8FF',
                    color: member.role === 'admin' ? '#1E40AF' : '#7C3AED',
                  }}
                >
                  {ROLE_LABELS[member.role]}
                </span>
              </div>
              <div className={styles.staffActions}>
                {member.id !== session?.user?.id && (
                  <button
                    className={styles.archiveButton}
                    onClick={() => handleArchive(member.id)}
                  >
                    Archivieren
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived Staff */}
      {archivedStaff.length > 0 && (
        <div className={styles.archivedSection}>
          <button
            className={styles.toggleArchived}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? '▾' : '▸'} Archivierte Mitarbeiter ({archivedStaff.length})
          </button>
          {showArchived && (
            <div className={styles.list}>
              {archivedStaff.map(member => (
                <div key={member.id} className={`${styles.staffCard} ${styles.archived}`}>
                  <div className={styles.staffInfo}>
                    <div className={styles.staffName}>{member.display_name}</div>
                    <span className={styles.archivedBadge}>Archiviert</span>
                  </div>
                  <button
                    className={styles.reactivateButton}
                    onClick={() => handleReactivate(member.id)}
                  >
                    Reaktivieren
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
