import { useMemo } from 'react';
import { useTimeSlots, usePractitionerSchedules, useInsuranceTypes, useTreatmentTypes } from '../../../hooks/useSupabase';
import { useTranslation } from '../../../i18n';
import styles from '../BookingWizard.module.css';
import timeStyles from './TimeSlotStep.module.css';

interface TimeSlotStepProps {
  selectedDate: string | null;
  selectedId: string | null;
  practitionerId: string | null;
  insuranceTypeId: string | null;
  treatmentTypeId: string | null;
  onSelect: (id: string, startTime: string, additionalSlotIds?: string[]) => void;
  onBack: () => void;
}

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR'
};

// ORTHO-025: Add minutes to a HH:MM time string
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function TimeSlotStep({ selectedDate, selectedId, practitionerId, insuranceTypeId, treatmentTypeId, onSelect, onBack }: TimeSlotStepProps) {
  const { data: timeSlots, loading, error } = useTimeSlots(selectedDate, practitionerId);
  const { data: practitionerSchedules } = usePractitionerSchedules(practitionerId);
  const { data: insuranceTypes } = useInsuranceTypes();
  const { data: treatmentTypes } = useTreatmentTypes();
  const { t, language } = useTranslation();

  // Determine if patient has public insurance (Gesetzlich) → hide private_only windows
  const isPublicInsurance = useMemo(() => {
    if (!insuranceTypeId || !insuranceTypes.length) return false;
    const selected = insuranceTypes.find(i => i.id === insuranceTypeId);
    return selected?.name?.includes('Gesetzlich') || false;
  }, [insuranceTypeId, insuranceTypes]);

  // ORTHO-025: Determine how many slots are needed based on treatment duration
  const slotsNeeded = useMemo(() => {
    if (!treatmentTypeId || !treatmentTypes.length) return 1;
    const treatment = treatmentTypes.find(t => t.id === treatmentTypeId);
    if (!treatment) return 1;
    return Math.ceil(treatment.duration_minutes / 10);
  }, [treatmentTypeId, treatmentTypes]);

  // Filter slots by practitioner schedule windows + insurance + past slots
  const filteredSlots = useMemo(() => {
    if (!selectedDate || !timeSlots.length) return timeSlots;

    let slots = timeSlots;

    // 1. Filter by practitioner schedule bookable windows (+ insurance_filter)
    if (practitionerSchedules.length > 0) {
      const selectedDateObj = new Date(selectedDate + 'T00:00:00');
      const jsDayOfWeek = selectedDateObj.getDay();
      const bookableWindows = practitionerSchedules
        .filter(s => {
          if (s.day_of_week !== jsDayOfWeek || !s.is_bookable) return false;
          // ORTHO-029: Hide private_only windows for public insurance patients
          if (isPublicInsurance && s.insurance_filter === 'private_only') return false;
          return true;
        })
        .map(s => ({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) }));

      if (bookableWindows.length > 0) {
        slots = slots.filter(slot => {
          const time = slot.start_time.slice(0, 5);
          return bookableWindows.some(w => time >= w.start && time < w.end);
        });
      } else {
        slots = [];
      }
    }

    // 2. Filter out past slots for today (with 30min buffer)
    const now = new Date();
    const selected = new Date(selectedDate + 'T00:00:00');
    const isToday = now.toDateString() === selected.toDateString();
    if (isToday) {
      const cutoff = new Date(now.getTime() + 30 * 60 * 1000);
      const cutoffTime = cutoff.toTimeString().slice(0, 5);
      slots = slots.filter(slot => slot.start_time.slice(0, 5) > cutoffTime);
    }

    // 3. ORTHO-025: For multi-slot treatments, only show slots where consecutive slots are available
    if (slotsNeeded > 1) {
      slots = slots.filter(slot => {
        const slotTime = slot.start_time.slice(0, 5);
        for (let i = 1; i < slotsNeeded; i++) {
          const nextTime = addMinutesToTime(slotTime, i * 10);
          // Check against ALL available slots (not just schedule-filtered) since blocking slots can be outside bookable windows
          if (!timeSlots.some(s => s.start_time.slice(0, 5) === nextTime)) return false;
        }
        return true;
      });
    }

    return slots;
  }, [timeSlots, selectedDate, practitionerSchedules, isPublicInsurance, slotsNeeded]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>{t('time.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorTitle}>{t('common.error')}</div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('time.title')}</h2>
        <p className={styles.stepDescription}>
          {selectedDate && formatDate(selectedDate)}
        </p>
      </div>

      {filteredSlots.length === 0 ? (
        <div className={timeStyles.noSlots}>
          <p>{t('time.noSlots')}</p>
          <button
            className={styles.backButton}
            onClick={onBack}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            {t('time.chooseOtherDay')}
          </button>
        </div>
      ) : (
        <div className={timeStyles.grid}>
          {filteredSlots.map((slot) => (
            <button
              key={slot.id}
              className={`${timeStyles.slot} ${selectedId === slot.id ? timeStyles.selected : ''}`}
              onClick={() => {
                if (slotsNeeded > 1) {
                  const slotTime = slot.start_time.slice(0, 5);
                  const additionalIds: string[] = [];
                  for (let i = 1; i < slotsNeeded; i++) {
                    const nextTime = addMinutesToTime(slotTime, i * 10);
                    const nextSlot = timeSlots.find(s => s.start_time.slice(0, 5) === nextTime);
                    if (nextSlot) additionalIds.push(nextSlot.id);
                  }
                  onSelect(slot.id, slot.start_time, additionalIds);
                } else {
                  onSelect(slot.id, slot.start_time);
                }
              }}
            >
              {formatTime(slot.start_time)}
            </button>
          ))}
        </div>
      )}

      <div className={styles.navigation}>
        <button className={styles.backButton} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
