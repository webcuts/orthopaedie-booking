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
} from './useAdminData';
export type { AppointmentWithDetails, PractitionerAbsence, Practitioner, SystemLog } from './useAdminData';
