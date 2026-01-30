import { useState, useCallback } from 'react';
import { Container, Card } from '../';
import { ProgressIndicator } from './ProgressIndicator';
import { SpecialtyStep } from './steps/SpecialtyStep';
import { InsuranceStep } from './steps/InsuranceStep';
import { TreatmentStep } from './steps/TreatmentStep';
import { PractitionerStep } from './steps/PractitionerStep';
import { DateStep } from './steps/DateStep';
import { TimeSlotStep } from './steps/TimeSlotStep';
import { ContactStep } from './steps/ContactStep';
import { SuccessStep } from './steps/SuccessStep';
import { useIframeResize } from '../../hooks';
import styles from './BookingWizard.module.css';

export interface BookingState {
  currentStep: number;
  specialtyId: string | null;
  insuranceTypeId: string | null;
  treatmentTypeId: string | null;
  practitionerId: string | null;
  selectedDate: string | null;
  timeSlotId: string | null;
  contactData: {
    name: string;
    email: string;
    phone: string;
  };
  bookingComplete: boolean;
  appointmentId: string | null;
}

const TOTAL_STEPS = 7;

const initialState: BookingState = {
  currentStep: 1,
  specialtyId: null,
  insuranceTypeId: null,
  treatmentTypeId: null,
  practitionerId: null,
  selectedDate: null,
  timeSlotId: null,
  contactData: {
    name: '',
    email: '',
    phone: ''
  },
  bookingComplete: false,
  appointmentId: null
};

export function BookingWizard() {
  const [state, setState] = useState<BookingState>(initialState);

  // Iframe-Höhe dynamisch anpassen bei Step-Wechsel
  useIframeResize([state.currentStep, state.bookingComplete]);

  const updateState = useCallback((updates: Partial<BookingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS)
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1)
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, Math.min(step, TOTAL_STEPS))
    }));
  }, []);

  const resetBooking = useCallback(() => {
    setState(initialState);
  }, []);

  const setBookingComplete = useCallback((appointmentId: string) => {
    setState(prev => ({
      ...prev,
      bookingComplete: true,
      appointmentId
    }));
  }, []);

  // Success Screen
  if (state.bookingComplete) {
    return (
      <Container size="sm" className={styles.container}>
        <Card variant="elevated" padding="lg">
          <SuccessStep
            state={state}
            onReset={resetBooking}
          />
        </Card>
      </Container>
    );
  }

  return (
    <Container size="sm" className={styles.container}>
      <Card variant="elevated" padding="lg">
        <div className={styles.header}>
          <h1 className={styles.title}>Termin buchen</h1>
          <p className={styles.subtitle}>Orthopädie Königstraße, Hannover</p>
        </div>

        <ProgressIndicator
          currentStep={state.currentStep}
          totalSteps={TOTAL_STEPS}
        />

        <div className={styles.stepContent}>
          {state.currentStep === 1 && (
            <SpecialtyStep
              selectedId={state.specialtyId}
              onSelect={(id) => {
                updateState({ specialtyId: id, practitionerId: null });
                nextStep();
              }}
            />
          )}

          {state.currentStep === 2 && (
            <InsuranceStep
              selectedId={state.insuranceTypeId}
              onSelect={(id) => {
                updateState({ insuranceTypeId: id });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {state.currentStep === 3 && (
            <TreatmentStep
              selectedId={state.treatmentTypeId}
              onSelect={(id) => {
                updateState({ treatmentTypeId: id });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {state.currentStep === 4 && (
            <PractitionerStep
              specialtyId={state.specialtyId}
              selectedId={state.practitionerId}
              onSelect={(id) => {
                updateState({ practitionerId: id });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {state.currentStep === 5 && (
            <DateStep
              selectedDate={state.selectedDate}
              onSelect={(date) => {
                updateState({ selectedDate: date, timeSlotId: null });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {state.currentStep === 6 && (
            <TimeSlotStep
              selectedDate={state.selectedDate}
              selectedId={state.timeSlotId}
              onSelect={(id) => {
                updateState({ timeSlotId: id });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {state.currentStep === 7 && (
            <ContactStep
              state={state}
              onUpdateContact={(contactData) => updateState({ contactData })}
              onComplete={setBookingComplete}
              onBack={prevStep}
              onGoToStep={goToStep}
            />
          )}
        </div>
      </Card>
    </Container>
  );
}
