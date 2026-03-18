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
}

interface PractitionerEntry {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  image_url: string | null;
  is_active: boolean;
  available_from: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  mfa: 'MFA',
};

export function StaffPage() {
  const { isAdmin, session } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPractitionerForm, setShowPractitionerForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Staff form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'mfa'>('mfa');

  // Practitioner form
  const [practTitle, setPractTitle] = useState('');
  const [practFirstName, setPractFirstName] = useState('');
  const [practLastName, setPractLastName] = useState('');
  const [practImageUrl, setPractImageUrl] = useState('');
  const [practAvailableFrom, setPractAvailableFrom] = useState('');
  const [practSpecialtyId, setPractSpecialtyId] = useState('');
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setStaff(data as StaffMember[]);
    setLoading(false);
  }, []);

  const fetchPractitioners = useCallback(async () => {
    const { data } = await supabase
      .from('practitioners')
      .select('id, title, first_name, last_name, image_url, is_active, available_from')
      .order('last_name');
    if (data) setPractitioners(data);
  }, []);

  const fetchSpecialties = useCallback(async () => {
    const { data } = await supabase.from('specialties').select('id, name');
    if (data) setSpecialties(data);
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchPractitioners();
    fetchSpecialties();
  }, [fetchStaff, fetchPractitioners, fetchSpecialties]);

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
        body: { action: 'create', email: newEmail.trim(), password: newPassword, displayName: newName.trim(), role: newRole },
      });
      if (response.error || !response.data?.success) {
        setFormError(response.data?.error || response.error?.message || 'Fehler beim Erstellen');
        return;
      }
      setShowForm(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('mfa');
      fetchStaff();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string, userId: string, role?: string) => {
    await supabase.functions.invoke('manage-staff', {
      body: { action, userId, role },
    });
    fetchStaff();
  };

  const handleCreatePractitioner = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!practFirstName.trim() || !practLastName.trim()) {
      setFormError('Vor- und Nachname sind Pflicht');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('practitioners').insert({
        title: practTitle.trim() || null,
        first_name: practFirstName.trim(),
        last_name: practLastName.trim(),
        image_url: practImageUrl.trim() || null,
        is_active: true,
        available_from: practAvailableFrom || null,
        specialty_id: practSpecialtyId || null,
      });
      if (error) {
        setFormError(error.message);
        return;
      }
      setShowPractitionerForm(false);
      setPractTitle(''); setPractFirstName(''); setPractLastName('');
      setPractImageUrl(''); setPractAvailableFrom(''); setPractSpecialtyId('');
      fetchPractitioners();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const activeStaff = staff.filter(s => s.is_active);
  const archivedStaff = staff.filter(s => !s.is_active);

  return (
    <div className={styles.container}>
      {/* === Mitarbeiter === */}
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Mitarbeiter</h1>
        <button className={styles.addButton} onClick={() => { setShowForm(true); setShowPractitionerForm(false); setFormError(null); }}>
          + Neuen Mitarbeiter
        </button>
      </div>

      {showForm && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Neuen Mitarbeiter anlegen</h3>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className={styles.formInput} placeholder="Vor- und Nachname" />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>E-Mail *</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={styles.formInput} placeholder="email@beispiel.de" />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Passwort *</label>
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={styles.formInput} placeholder="Initiales Passwort" />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Rolle *</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'mfa')} className={styles.formInput}>
                <option value="mfa">MFA (Kalender, Termine, Vorbestellungen)</option>
                <option value="admin">Admin (Vollzugriff inkl. Mitarbeiterverwaltung)</option>
              </select>
            </div>
            {formError && <div className={styles.formError}>{formError}</div>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setShowForm(false)}>Abbrechen</button>
              <button type="submit" className={styles.submitButton} disabled={saving}>{saving ? 'Wird erstellt...' : 'Erstellen'}</button>
            </div>
          </form>
        </div>
      )}

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
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => handleAction('update-role', member.id, e.target.value)}
                      className={styles.roleSelect}
                    >
                      <option value="mfa">MFA</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className={styles.archiveButton} onClick={() => handleAction('archive', member.id)}>
                      Archivieren
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {archivedStaff.length > 0 && (
        <div className={styles.archivedSection}>
          <button className={styles.toggleArchived} onClick={() => setShowArchived(!showArchived)}>
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
                  <button className={styles.reactivateButton} onClick={() => handleAction('reactivate', member.id)}>
                    Reaktivieren
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === Behandler === */}
      <div className={styles.headerRow} style={{ marginTop: '2rem' }}>
        <h2 className={styles.title}>Behandler</h2>
        <button className={styles.addButton} onClick={() => { setShowPractitionerForm(true); setShowForm(false); setFormError(null); }}>
          + Neuen Behandler
        </button>
      </div>

      {showPractitionerForm && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Neuen Behandler anlegen</h3>
          <form onSubmit={handleCreatePractitioner} className={styles.form}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Titel</label>
              <input type="text" value={practTitle} onChange={(e) => setPractTitle(e.target.value)} className={styles.formInput} placeholder="z.B. Dr. med." />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Vorname *</label>
              <input type="text" value={practFirstName} onChange={(e) => setPractFirstName(e.target.value)} className={styles.formInput} />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Nachname *</label>
              <input type="text" value={practLastName} onChange={(e) => setPractLastName(e.target.value)} className={styles.formInput} />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Fachrichtung</label>
              <select value={practSpecialtyId} onChange={(e) => setPractSpecialtyId(e.target.value)} className={styles.formInput}>
                <option value="">— keine —</option>
                {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Foto-URL</label>
              <input type="url" value={practImageUrl} onChange={(e) => setPractImageUrl(e.target.value)} className={styles.formInput} placeholder="https://..." />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Anzeige ab</label>
              <input type="date" value={practAvailableFrom} onChange={(e) => setPractAvailableFrom(e.target.value)} className={styles.formInput} />
            </div>
            {formError && <div className={styles.formError}>{formError}</div>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setShowPractitionerForm(false)}>Abbrechen</button>
              <button type="submit" className={styles.submitButton} disabled={saving}>{saving ? 'Wird erstellt...' : 'Erstellen'}</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.list}>
        {practitioners.map(p => (
          <div key={p.id} className={styles.staffCard}>
            <div className={styles.staffInfo}>
              {p.image_url && (
                <img src={p.image_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              )}
              <div className={styles.staffName}>
                {[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}
              </div>
              {p.available_from && new Date(p.available_from) > new Date() && (
                <span className={styles.archivedBadge}>
                  Sichtbar ab {new Date(p.available_from).toLocaleDateString('de-DE')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
