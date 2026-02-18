import { useState, useMemo } from 'react';
import { useAvailableDates } from '../../../hooks/useSupabase';
import { useAdminAvailableSlots, useAdminMfaAvailableSlots, useRescheduleAppointment, type AppointmentWithDetails } from '../../hooks';
import styles from './RescheduleModal.module.css';

interface RescheduleModalProps {
  appointment: AppointmentWithDetails;
  onClose: () => void;
  onRescheduled: () => void;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function RescheduleModal({ appointment, onClose, onRescheduled }: RescheduleModalProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [additionalSlotIds, setAdditionalSlotIds] = useState<string[]>([]);

  const isMfa = appointment.bookingType === 'mfa';
  const practitionerId = isMfa ? null : (appointment.practitioner?.id || null);
  const durationMinutes = appointment.treatment_type?.duration_minutes || 10;
  const slotsNeeded = Math.ceil(durationMinutes / 10);

  const { data: availableDates, loading: datesLoading } = useAvailableDates(currentMonth, practitionerId);
  const { slots: doctorSlots, loading: doctorSlotsLoading } = useAdminAvailableSlots(
    !isMfa ? selectedDate : null,
    practitionerId
  );
  const { slots: mfaSlots, loading: mfaSlotsLoading } = useAdminMfaAvailableSlots(
    isMfa ? selectedDate : null
  );

  const { reschedule, loading: rescheduleLoading, error: rescheduleError, clearError } = useRescheduleAppointment();

  const slotsLoading = isMfa ? mfaSlotsLoading : doctorSlotsLoading;

  // For doctor: filter to slots where consecutive slots are available (multi-slot)
  const displaySlots = useMemo(() => {
    if (isMfa) {
      return mfaSlots.filter(s => s.available);
    }

    let slots = doctorSlots;

    if (slotsNeeded > 1) {
      slots = slots.filter(slot => {
        const slotTime = slot.start_time.slice(0, 5);
        for (let i = 1; i < slotsNeeded; i++) {
          const nextTime = addMinutesToTime(slotTime, i * 10);
          if (!doctorSlots.some(s => s.start_time.slice(0, 5) === nextTime)) return false;
        }
        return true;
      });
    }

    return slots;
  }, [isMfa, doctorSlots, mfaSlots, slotsNeeded]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  }, [currentMonth]);

  const canGoPrev = useMemo(() => {
    const prevMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return prevMonthDate >= thisMonth;
  }, [currentMonth, today]);

  const formatMonth = (date: Date) =>
    date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isDateAvailable = (date: Date) => {
    if (date < today) return false;
    const dateStr = formatLocalDate(date);
    return availableDates.includes(dateStr);
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlotId(null);
    setAdditionalSlotIds([]);
    clearError();
  };

  const handleSlotSelect = (slotId: string, startTime: string) => {
    setSelectedSlotId(slotId);

    // For multi-slot: collect additional consecutive slot IDs
    if (!isMfa && slotsNeeded > 1) {
      const ids: string[] = [];
      const slotTime = startTime.slice(0, 5);
      for (let i = 1; i < slotsNeeded; i++) {
        const nextTime = addMinutesToTime(slotTime, i * 10);
        const nextSlot = doctorSlots.find(s => s.start_time.slice(0, 5) === nextTime);
        if (nextSlot) ids.push(nextSlot.id);
      }
      setAdditionalSlotIds(ids);
    } else {
      setAdditionalSlotIds([]);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlotId) return;

    const result = await reschedule({
      appointmentId: appointment.id,
      bookingType: isMfa ? 'mfa' : 'doctor',
      newSlotId: selectedSlotId,
      additionalSlotIds: additionalSlotIds.length > 0 ? additionalSlotIds : undefined,
      oldDate: appointment.time_slot?.date,
      oldTime: appointment.time_slot?.start_time,
      patientEmail: appointment.patient?.email,
    });

    if (result.success) {
      onRescheduled();
    }
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
          <h2 className={styles.title}>Termin verlegen</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {/* Current appointment info */}
          <div className={styles.infoBox}>
            <h3 className={styles.infoBoxTitle}>Aktueller Termin</h3>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Datum</span>
              <span className={styles.infoValue}>{formatDate(appointment.time_slot?.date)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Uhrzeit</span>
              <span className={styles.infoValue}>
                {appointment.time_slot?.start_time?.slice(0, 5)} Uhr
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Patient</span>
              <span className={styles.infoValue}>{appointment.patient?.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Behandler</span>
              <span className={styles.infoValue}>{practitionerName}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Behandlung</span>
              <span className={styles.infoValue}>
                {appointment.treatment_type?.name} ({durationMinutes} Min.)
              </span>
            </div>
          </div>

          {/* No email warning */}
          {!appointment.patient?.email && (
            <div className={styles.noEmailWarning}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Patient hat keine E-Mail. Bitte telefonisch benachrichtigen.
            </div>
          )}

          {/* Calendar */}
          <div className={styles.calendar}>
            <h3 className={styles.sectionTitle}>Neues Datum wählen</h3>
            <div className={styles.calendarHeader}>
              <button
                className={styles.calendarNav}
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                disabled={!canGoPrev}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className={styles.monthLabel}>{formatMonth(currentMonth)}</span>
              <button
                className={styles.calendarNav}
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className={styles.weekdays}>
              {WEEKDAYS.map(day => (
                <div key={day} className={styles.weekday}>{day}</div>
              ))}
            </div>

            {datesLoading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
              </div>
            ) : (
              <div className={styles.days}>
                {calendarDays.map((date, index) => {
                  if (!date) return <div key={`empty-${index}`} className={styles.emptyDay} />;

                  const dateStr = formatLocalDate(date);
                  const isSelected = selectedDate === dateStr;
                  const isSelectable = isDateAvailable(date);
                  const isToday = date.getTime() === today.getTime();

                  return (
                    <button
                      key={dateStr}
                      className={`${styles.day} ${isSelected ? styles.selected : ''} ${isToday ? styles.today : ''}`}
                      onClick={() => isSelectable && handleDateSelect(dateStr)}
                      disabled={!isSelectable}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div className={styles.slotSection}>
              <h3 className={styles.sectionTitle}>
                Neue Uhrzeit wählen — {formatDate(selectedDate)}
              </h3>
              {slotsLoading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                </div>
              ) : displaySlots.length === 0 ? (
                <div className={styles.noSlots}>Keine verfügbaren Zeitslots an diesem Tag.</div>
              ) : (
                <div className={styles.slotGrid}>
                  {displaySlots.map(slot => (
                    <button
                      key={slot.id}
                      className={`${styles.slotButton} ${selectedSlotId === slot.id ? styles.selected : ''}`}
                      onClick={() => handleSlotSelect(slot.id, slot.start_time)}
                    >
                      {slot.start_time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {rescheduleError && (
            <div className={styles.error}>{rescheduleError}</div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            Abbrechen
          </button>
          <button
            className={styles.rescheduleButton}
            disabled={!selectedSlotId || rescheduleLoading}
            onClick={handleReschedule}
          >
            {rescheduleLoading ? 'Wird verlegt...' : 'Termin verlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
