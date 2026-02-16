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
  // Practitioner Schedules (ORTHO-028)
  usePractitionerSchedulesAdmin,
} from './useAdminData';
export type { AppointmentWithDetails, PractitionerAbsence, PractitionerScheduleEntry, Practitioner, SystemLog, AnalyticsData } from './useAdminData';
