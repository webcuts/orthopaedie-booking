export { useAuth } from './useAuth';
export {
  useAppointments,
  useAppointmentDetails,
  useUpdateAppointmentStatus,
  useAdminTimeSlots,
  useBlockSlot,
  useTreatmentTypes,
  useGenerateSlots,
  usePractitionerAbsences,
  useAdminCreateBooking,
  useAdminAvailableSlots,
  useAnonymizePatient,
  useSystemLogs,
  useAnalytics,
} from './useAdminData';
export type { AppointmentWithDetails, PractitionerAbsence, Practitioner, SystemLog, AnalyticsData } from './useAdminData';
