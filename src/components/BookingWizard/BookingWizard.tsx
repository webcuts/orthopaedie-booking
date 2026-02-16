import { useState, useCallback, useMemo } from 'react';
import { Container, Card } from '../';
import { LanguageProvider, LanguageSelector, useTranslation } from '../../i18n';
import { ProgressIndicator } from './ProgressIndicator';
import { SpecialtyStep } from './steps/SpecialtyStep';
import { InsuranceStep } from './steps/InsuranceStep';
import { BookingTypeStep } from './steps/BookingTypeStep';
import { TreatmentStep } from './steps/TreatmentStep';
import { PractitionerStep } from './steps/PractitionerStep';
import { DateStep } from './steps/DateStep';
import { TimeSlotStep } from './steps/TimeSlotStep';
import { MfaTreatmentStep } from './steps/MfaTreatmentStep';
import { MfaCalendarStep } from './steps/MfaCalendarStep';
import { ContactStep } from './steps/ContactStep';
import { SuccessStep } from './steps/SuccessStep';
import { useIframeResize } from '../../hooks';
import styles from './BookingWizard.module.css';

export type StepType =
  | 'specialty'
  | 'insurance'
  | 'bookingType'
  | 'treatment'
  | 'practitioner'
  | 'date'
  | 'time'
  | 'mfaTreatment'
  | 'mfaCalendar'
  | 'contact';

export interface BookingState {
  currentStep: number;
  bookingType: 'doctor' | 'mfa' | null;
  specialtyId: string | null;
  insuranceTypeId: string | null;
  treatmentTypeId: string | null;
  practitionerId: string | null;
  selectedDate: string | null;
  timeSlotId: string | null;
  selectedStartTime: string | null;
  // MFA-specific
  mfaTreatmentTypeId: string | null;
  mfaTimeSlotId: string | null;
  mfaSelectedDate: string | null;
  mfaSelectedStartTime: string | null;
  contactData: {
    name: string;
    email: string;
    phone: string;
  };
  bookingComplete: boolean;
  appointmentId: string | null;
}

const DOCTOR_STEPS: StepType[] = ['specialty', 'insurance', 'bookingType', 'treatment', 'practitioner', 'date', 'time', 'contact'];
const MFA_STEPS: StepType[] = ['specialty', 'insurance', 'bookingType', 'mfaTreatment', 'mfaCalendar', 'contact'];
const SHARED_STEPS: StepType[] = ['specialty', 'insurance', 'bookingType'];

export const STEP_LABEL_KEYS: Record<StepType, string> = {
  specialty: 'step.specialty',
  insurance: 'step.insurance',
  bookingType: 'step.bookingType',
  treatment: 'step.treatment',
  practitioner: 'step.practitioner',
  date: 'step.date',
  time: 'step.time',
  mfaTreatment: 'step.mfaTreatment',
  mfaCalendar: 'step.mfaCalendar',
  contact: 'step.contact',
};

export function getSteps(bookingType: 'doctor' | 'mfa' | null): StepType[] {
  if (bookingType === 'mfa') return MFA_STEPS;
  if (bookingType === 'doctor') return DOCTOR_STEPS;
  return SHARED_STEPS;
}

const initialState: BookingState = {
  currentStep: 1,
  bookingType: null,
  specialtyId: null,
  insuranceTypeId: null,
  treatmentTypeId: null,
  practitionerId: null,
  selectedDate: null,
  timeSlotId: null,
  selectedStartTime: null,
  mfaTreatmentTypeId: null,
  mfaTimeSlotId: null,
  mfaSelectedDate: null,
  mfaSelectedStartTime: null,
  contactData: {
    name: '',
    email: '',
    phone: ''
  },
  bookingComplete: false,
  appointmentId: null
};

function BookingWizardInner() {
  const { t } = useTranslation();
  const [state, setState] = useState<BookingState>(initialState);
  const [wizardStartTime] = useState(() => Date.now());

  const steps = useMemo(() => getSteps(state.bookingType), [state.bookingType]);
  const totalSteps = steps.length;
  const currentStepType = steps[state.currentStep - 1] as StepType | undefined;

  // Iframe-Höhe dynamisch anpassen bei Step-Wechsel
  useIframeResize([state.currentStep, state.bookingComplete]);

  const updateState = useCallback((updates: Partial<BookingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      const stepsForType = getSteps(prev.bookingType);
      return {
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, stepsForType.length)
      };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1)
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState(prev => {
      const stepsForType = getSteps(prev.bookingType);
      return {
        ...prev,
        currentStep: Math.max(1, Math.min(step, stepsForType.length))
      };
    });
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
      <Container size="lg" className={styles.container}>
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
    <Container size="lg" className={styles.container}>
      <Card variant="elevated" padding="lg">
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.title}>{t('title')}</h1>
              <p className={styles.subtitle}>Orthopädie Königstraße, Hannover</p>
            </div>
            <LanguageSelector />
          </div>
        </div>

        <ProgressIndicator
          currentStep={state.currentStep}
          totalSteps={totalSteps}
          steps={steps}
        />

        <div className={styles.stepContent}>
          {currentStepType === 'specialty' && (
            <SpecialtyStep
              selectedId={state.specialtyId}
              onSelect={(id) => {
                updateState({ specialtyId: id, practitionerId: null });
                nextStep();
              }}
            />
          )}

          {currentStepType === 'insurance' && (
            <InsuranceStep
              selectedId={state.insuranceTypeId}
              onSelect={(id) => {
                updateState({ insuranceTypeId: id });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {currentStepType === 'bookingType' && (
            <BookingTypeStep
              selectedType={state.bookingType}
              onSelect={(type) => {
                updateState({ bookingType: type });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {currentStepType === 'treatment' && (
            <TreatmentStep
              selectedId={state.treatmentTypeId}
              onSelect={(id) => {
                updateState({ treatmentTypeId: id });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {currentStepType === 'practitioner' && (
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

          {currentStepType === 'date' && (
            <DateStep
              selectedDate={state.selectedDate}
              practitionerId={state.practitionerId}
              insuranceTypeId={state.insuranceTypeId}
              onSelect={(date) => {
                updateState({ selectedDate: date, timeSlotId: null });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {currentStepType === 'time' && (
            <TimeSlotStep
              selectedDate={state.selectedDate}
              selectedId={state.timeSlotId}
              practitionerId={state.practitionerId}
              insuranceTypeId={state.insuranceTypeId}
              onSelect={(id, startTime) => {
                updateState({ timeSlotId: id, selectedStartTime: startTime });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {currentStepType === 'mfaTreatment' && (
            <MfaTreatmentStep
              selectedId={state.mfaTreatmentTypeId}
              specialtyId={state.specialtyId}
              onSelect={(id) => {
                updateState({ mfaTreatmentTypeId: id });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {currentStepType === 'mfaCalendar' && (
            <MfaCalendarStep
              selectedDate={state.mfaSelectedDate}
              selectedTimeSlotId={state.mfaTimeSlotId}
              onSelect={(date, slotId, startTime) => {
                updateState({
                  mfaSelectedDate: date,
                  mfaTimeSlotId: slotId,
                  mfaSelectedStartTime: startTime
                });
                nextStep();
              }}
              onBack={prevStep}
            />
          )}

          {currentStepType === 'contact' && (
            <ContactStep
              state={state}
              steps={steps}
              onUpdateContact={(contactData) => updateState({ contactData })}
              onComplete={setBookingComplete}
              onBack={prevStep}
              onGoToStep={goToStep}
              wizardStartTime={wizardStartTime}
            />
          )}
        </div>
      </Card>
    </Container>
  );
}

export function BookingWizard() {
  return (
    <LanguageProvider>
      <BookingWizardInner />
    </LanguageProvider>
  );
}
