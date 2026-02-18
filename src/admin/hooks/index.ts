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
  // MFA
  useMfaAppointments,
  useUpdateMfaAppointmentStatus,
  useMfaTreatmentTypesAdmin,
  useAdminCreateMfaBooking,
  useAdminMfaAvailableSlots,
  useGenerateMfaSlots,
  // Reschedule (ORTHO-031)
  useRescheduleAppointment,
  // Practitioner Schedules (ORTHO-028)
  usePractitionerSchedulesAdmin,
} from './useAdminData';
export type { AppointmentWithDetails, PractitionerAbsence, PractitionerScheduleEntry, Practitioner, SystemLog, AnalyticsData } from './useAdminData';
