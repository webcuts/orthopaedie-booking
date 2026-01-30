import { useMemo } from 'react';
import { Button } from '../../';
import {
  useSpecialties,
  useTreatmentTypes,
  usePractitioners,
  useTimeSlots
} from '../../../hooks/useSupabase';
import { getPractitionerFullName } from '../../../types/database';
import type { BookingState } from '../BookingWizard';
import styles from './SuccessStep.module.css';

interface SuccessStepProps {
  state: BookingState;
  onReset: () => void;
}

export function SuccessStep({ state, onReset }: SuccessStepProps) {
  const { data: specialties } = useSpecialties();
  const { data: treatmentTypes } = useTreatmentTypes();
  const { data: practitioners } = usePractitioners(state.specialtyId);
  const { data: timeSlots } = useTimeSlots(state.selectedDate);

  const selectedSpecialty = useMemo(() =>
    specialties.find(s => s.id === state.specialtyId),
    [specialties, state.specialtyId]
  );

  const selectedTreatment = useMemo(() =>
    treatmentTypes.find(t => t.id === state.treatmentTypeId),
    [treatmentTypes, state.treatmentTypeId]
  );

  const selectedPractitioner = useMemo(() =>
    practitioners.find(p => p.id === state.practitionerId),
    [practitioners, state.practitionerId]
  );

  const selectedSlot = useMemo(() =>
    timeSlots.find(s => s.id === state.timeSlotId),
    [timeSlots, state.timeSlotId]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => time.substring(0, 5);

  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <h1 className={styles.title}>Termin erfolgreich gebucht!</h1>
      <p className={styles.subtitle}>
        Wir haben Ihnen eine Bestätigung an <strong>{state.contactData.email}</strong> gesendet.
      </p>

      <div className={styles.details}>
        <h2 className={styles.detailsTitle}>Ihre Termindetails</h2>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Datum & Uhrzeit</span>
          <span className={styles.detailValue}>
            {state.selectedDate && formatDate(state.selectedDate)}
            <br />
            {selectedSlot && formatTime(selectedSlot.start_time)} Uhr
          </span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Terminart</span>
          <span className={styles.detailValue}>
            {selectedTreatment?.name}
          </span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Fachgebiet</span>
          <span className={styles.detailValue}>
            {selectedSpecialty?.name}
          </span>
        </div>

        {selectedPractitioner && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Behandler</span>
            <span className={styles.detailValue}>
              {getPractitionerFullName(selectedPractitioner)}
            </span>
          </div>
        )}

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Patient</span>
          <span className={styles.detailValue}>
            {state.contactData.name}
          </span>
        </div>
      </div>

      <div className={styles.address}>
        <h3>Praxisadresse</h3>
        <p>Orthopädie Königstraße</p>
        <p>Königstraße 51</p>
        <p>30175 Hannover</p>
      </div>

      <div className={styles.reminder}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div>
          <strong>Erinnerung:</strong> Sie erhalten 24 Stunden und 6 Stunden vor dem Termin eine E-Mail-Erinnerung.
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" onClick={onReset}>
          Weiteren Termin buchen
        </Button>
      </div>
    </div>
  );
}
