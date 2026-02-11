import { useState } from 'react';
import { useUpdateAppointmentStatus, useUpdateMfaAppointmentStatus, useAnonymizePatient, type AppointmentWithDetails } from '../../hooks';
import styles from './AppointmentModal.module.css';

interface AppointmentModalProps {
  appointment: AppointmentWithDetails;
  onClose: () => void;
  onStatusUpdate: () => void;
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'pending', label: 'Offen', color: '#F59E0B' },
  { value: 'confirmed', label: 'Bestätigt', color: '#22C55E' },
  { value: 'cancelled', label: 'Storniert', color: '#DC3545' },
  { value: 'completed', label: 'Erledigt', color: '#6B7280' },
];

export function AppointmentModal({
  appointment,
  onClose,
  onStatusUpdate,
}: AppointmentModalProps) {
  const [status, setStatus] = useState(appointment.status);
  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);
  const { updateStatus: updateDoctorStatus, loading: doctorLoading } = useUpdateAppointmentStatus();
  const { updateStatus: updateMfaStatus, loading: mfaLoading } = useUpdateMfaAppointmentStatus();
  const { anonymize, loading: anonymizing } = useAnonymizePatient();

  const isMfa = appointment.bookingType === 'mfa';
  const loading = isMfa ? mfaLoading : doctorLoading;

  const isAnonymized = appointment.patient?.name === 'Gelöscht';
  const canAnonymize = (status === 'cancelled' || status === 'completed') && !isAnonymized;

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as typeof status);
    const updateFn = isMfa ? updateMfaStatus : updateDoctorStatus;
    const result = await updateFn(
      appointment.id,
      newStatus as 'pending' | 'confirmed' | 'cancelled' | 'completed'
    );
    if (result.success) {
      onStatusUpdate();
    }
  };

  const handleAnonymize = async () => {
    if (!appointment.patient?.id) return;
    const result = await anonymize(appointment.patient.id);
    if (result.success) {
      setShowAnonymizeConfirm(false);
      onStatusUpdate();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCreatedAt = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const practitionerName = isMfa
    ? 'MFA / Praxisleistung'
    : appointment.practitioner
      ? `${appointment.practitioner.title || ''} ${appointment.practitioner.first_name} ${appointment.practitioner.last_name}`.trim()
      : 'Keine Präferenz';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            Termindetails
            {isMfa && <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 500, padding: '2px 8px', borderRadius: 9999, background: '#F3E8FF', color: '#7C3AED' }}>MFA</span>}
          </h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {/* Patient Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Patient</h3>
            <div className={styles.field}>
              <span className={styles.label}>Name</span>
              <span className={styles.value}>{appointment.patient?.name}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>E-Mail</span>
              <a href={`mailto:${appointment.patient?.email}`} className={styles.link}>
                {appointment.patient?.email}
              </a>
            </div>
            {appointment.patient?.phone && (
              <div className={styles.field}>
                <span className={styles.label}>Telefon</span>
                <a href={`tel:${appointment.patient?.phone}`} className={styles.link}>
                  {appointment.patient?.phone}
                </a>
              </div>
            )}
          </section>

          {/* Appointment Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Termin</h3>
            <div className={styles.field}>
              <span className={styles.label}>Datum</span>
              <span className={styles.value}>
                {formatDate(appointment.time_slot?.date)}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Uhrzeit</span>
              <span className={styles.value}>
                {appointment.time_slot?.start_time?.slice(0, 5)} -{' '}
                {appointment.time_slot?.end_time?.slice(0, 5)} Uhr
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Dauer</span>
              <span className={styles.value}>
                {appointment.treatment_type?.duration_minutes} Minuten
              </span>
            </div>
          </section>

          {/* Treatment Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Behandlung</h3>
            <div className={styles.field}>
              <span className={styles.label}>Terminart</span>
              <span className={styles.value}>{appointment.treatment_type?.name}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Behandler</span>
              <span className={styles.value}>{practitionerName}</span>
            </div>
            {(appointment as any).insurance_type && (
              <div className={styles.field}>
                <span className={styles.label}>Versicherung</span>
                <span className={styles.value}>
                  {(appointment as any).insurance_type?.name}
                </span>
              </div>
            )}
          </section>

          {/* Status Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Status</h3>
            <div className={styles.statusButtons}>
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`${styles.statusButton} ${
                    status === option.value ? styles.active : ''
                  }`}
                  style={{
                    borderColor: status === option.value ? option.color : undefined,
                    backgroundColor: status === option.value ? option.color : undefined,
                  }}
                  onClick={() => handleStatusChange(option.value)}
                  disabled={loading}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          {/* DSGVO: Anonymize Patient Data */}
          {canAnonymize && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Datenschutz (DSGVO)</h3>
              {!showAnonymizeConfirm ? (
                <button
                  className={styles.anonymizeButton}
                  onClick={() => setShowAnonymizeConfirm(true)}
                >
                  Patientendaten löschen
                </button>
              ) : (
                <div className={styles.anonymizeConfirm}>
                  <p className={styles.anonymizeWarning}>
                    Patientendaten (Name, E-Mail, Telefon) werden unwiderruflich gelöscht. Der Termin bleibt als anonymisierter Eintrag erhalten.
                  </p>
                  <div className={styles.anonymizeActions}>
                    <button
                      className={styles.anonymizeConfirmButton}
                      onClick={handleAnonymize}
                      disabled={anonymizing}
                    >
                      {anonymizing ? 'Wird gelöscht...' : 'Unwiderruflich löschen'}
                    </button>
                    <button
                      className={styles.anonymizeCancelButton}
                      onClick={() => setShowAnonymizeConfirm(false)}
                      disabled={anonymizing}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {isAnonymized && (
            <section className={styles.section}>
              <div className={styles.anonymizedBadge}>
                Patientendaten wurden gemäß DSGVO gelöscht
              </div>
            </section>
          )}

          {/* Meta Section */}
          <section className={styles.section}>
            <div className={styles.meta}>
              Gebucht am {formatCreatedAt(appointment.created_at)}
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.closeButtonFooter}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
