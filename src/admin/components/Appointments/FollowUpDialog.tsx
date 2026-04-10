import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import styles from './FollowUpDialog.module.css';

interface FollowUpDialogProps {
  parentAppointmentId: string;
  treatmentName: string;
  followUpCount: number;
  patientId: string;
  patientName: string;
  mfaTreatmentTypeId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface SlotInfo {
  id: string;
  start_time: string;
  end_time: string;
  available: boolean;
}

interface FollowUpState {
  date: string;
  slotId: string;
  booked: boolean;
  appointmentId?: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function FollowUpDialog({
  parentAppointmentId,
  treatmentName,
  followUpCount,
  patientId,
  patientName,
  mfaTreatmentTypeId,
  onClose,
  onComplete,
}: FollowUpDialogProps) {
  const [followUps, setFollowUps] = useState<FollowUpState[]>(
    Array.from({ length: followUpCount }, () => ({ date: '', slotId: '', booked: false }))
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const todayStr = formatLocalDate(new Date());
  const allBooked = followUps.every(fu => fu.booked);

  // Load slots when date changes
  useEffect(() => {
    const currentDate = followUps[activeIndex]?.date;
    if (!currentDate) {
      setSlots([]);
      return;
    }

    async function loadSlots() {
      setSlotsLoading(true);
      try {
        const { data: mfaSlots, error: slotsError } = await supabase
          .from('mfa_time_slots')
          .select('id, start_time, end_time, max_parallel')
          .eq('date', currentDate)
          .order('start_time');

        if (slotsError) throw slotsError;
        if (!mfaSlots?.length) {
          setSlots([]);
          return;
        }

        const slotIds = mfaSlots.map(s => s.id);
        const { data: bookings } = await supabase
          .from('mfa_appointments')
          .select('mfa_time_slot_id')
          .in('mfa_time_slot_id', slotIds)
          .neq('status', 'cancelled');

        const counts = new Map<string, number>();
        (bookings || []).forEach(b => {
          counts.set(b.mfa_time_slot_id, (counts.get(b.mfa_time_slot_id) || 0) + 1);
        });

        setSlots(mfaSlots.map(s => ({
          id: s.id,
          start_time: s.start_time,
          end_time: s.end_time,
          available: (counts.get(s.id) || 0) < s.max_parallel,
        })));
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    }
    loadSlots();
  }, [followUps, activeIndex]);

  const handleDateChange = (date: string) => {
    setFollowUps(prev => {
      const next = [...prev];
      next[activeIndex] = { ...next[activeIndex], date, slotId: '' };
      return next;
    });
  };

  const handleSlotSelect = (slotId: string) => {
    setFollowUps(prev => {
      const next = [...prev];
      next[activeIndex] = { ...next[activeIndex], slotId };
      return next;
    });
  };

  const handleBookFollowUp = async () => {
    const current = followUps[activeIndex];
    if (!current.slotId) return;

    setBooking(true);
    setError(null);

    try {
      const { data: appointment, error: err } = await supabase
        .from('mfa_appointments')
        .insert({
          patient_id: patientId,
          mfa_treatment_type_id: mfaTreatmentTypeId,
          mfa_time_slot_id: current.slotId,
          parent_appointment_id: parentAppointmentId,
          status: 'confirmed',
          booked_by: 'admin',
        })
        .select('id')
        .single();

      if (err) throw err;

      setFollowUps(prev => {
        const next = [...prev];
        next[activeIndex] = { ...next[activeIndex], booked: true, appointmentId: appointment.id };
        return next;
      });

      // Move to next unbooked follow-up
      const nextUnbooked = followUps.findIndex((fu, i) => i > activeIndex && !fu.booked);
      if (nextUnbooked !== -1) {
        setActiveIndex(nextUnbooked);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Buchen des Folgetermins');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Folgetermine vergeben</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.info}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <p className={styles.infoText}>
              <strong>{treatmentName}</strong> für {patientName} erfordert {followUpCount} Folgetermin{followUpCount > 1 ? 'e' : ''}.
              Wählen Sie Datum und Uhrzeit für jeden Folgetermin.
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {followUps.map((fu, index) => (
            <div
              key={index}
              className={`${styles.followUpItem} ${fu.booked ? styles.completed : ''}`}
            >
              <div className={styles.followUpHeader}>
                <span className={styles.followUpLabel}>
                  Folgetermin {index + 1} von {followUpCount}
                </span>
                <span className={`${styles.followUpBadge} ${fu.booked ? styles.badgeBooked : styles.badgePending}`}>
                  {fu.booked ? 'Gebucht' : 'Offen'}
                </span>
              </div>

              {fu.booked ? (
                <div className={styles.completedText}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Termin am {fu.date} gebucht
                </div>
              ) : activeIndex === index ? (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Datum</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={fu.date}
                        min={todayStr}
                        onChange={(e) => handleDateChange(e.target.value)}
                      />
                    </div>
                  </div>

                  {fu.date && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label className={styles.label}>Uhrzeit</label>
                      {slotsLoading ? (
                        <div className={styles.slotsLoading}>Lade verfügbare Zeiten...</div>
                      ) : slots.filter(s => s.available).length === 0 ? (
                        <div className={styles.noSlots}>Keine verfügbaren Zeitslots an diesem Tag.</div>
                      ) : (
                        <div className={styles.slotGrid}>
                          {slots.filter(s => s.available).map(slot => (
                            <button
                              key={slot.id}
                              type="button"
                              className={`${styles.slotButton} ${fu.slotId === slot.id ? styles.selected : ''}`}
                              onClick={() => handleSlotSelect(slot.id)}
                            >
                              {slot.start_time.substring(0, 5)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className={styles.bookButton}
                    disabled={!fu.slotId || booking}
                    onClick={handleBookFollowUp}
                  >
                    {booking ? 'Wird gebucht...' : `Folgetermin ${index + 1} buchen`}
                  </button>
                </>
              ) : (
                <button
                  className={styles.bookButton}
                  onClick={() => setActiveIndex(index)}
                  style={{ background: '#6B7280' }}
                >
                  Folgetermin {index + 1} auswählen
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button className={styles.skipButton} onClick={onClose}>
            {allBooked ? 'Schließen' : 'Später vergeben'}
          </button>
          {allBooked && (
            <button className={styles.doneButton} onClick={onComplete}>
              Fertig
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
