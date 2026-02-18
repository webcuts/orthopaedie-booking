import { useState, useCallback } from 'react';
import { CalendarView, AppointmentModal, NewAppointmentModal, RescheduleModal } from '../components';
import { AnalyticsWidget } from '../components/Dashboard/AnalyticsWidget';
import { SystemStatus } from '../components/Dashboard/SystemStatus';
import { type AppointmentWithDetails } from '../hooks';

export function DashboardPage() {
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<AppointmentWithDetails | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAppointmentClick = useCallback((appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedAppointment(null);
  }, []);

  const handleStatusUpdate = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleNewAppointment = useCallback(() => {
    setShowNewAppointment(true);
  }, []);

  const handleCloseNewAppointment = useCallback(() => {
    setShowNewAppointment(false);
  }, []);

  const handleAppointmentCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleReschedule = useCallback(() => {
    setRescheduleAppointment(selectedAppointment);
    setSelectedAppointment(null);
  }, [selectedAppointment]);

  const handleRescheduled = useCallback(() => {
    setRescheduleAppointment(null);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <AnalyticsWidget />

      <CalendarView
        key={refreshKey}
        onAppointmentClick={handleAppointmentClick}
        onNewAppointment={handleNewAppointment}
      />

      {selectedAppointment && (
        <AppointmentModal
          appointment={selectedAppointment}
          onClose={handleCloseModal}
          onStatusUpdate={handleStatusUpdate}
          onReschedule={handleReschedule}
        />
      )}

      {rescheduleAppointment && (
        <RescheduleModal
          appointment={rescheduleAppointment}
          onClose={() => setRescheduleAppointment(null)}
          onRescheduled={handleRescheduled}
        />
      )}

      {showNewAppointment && (
        <NewAppointmentModal
          onClose={handleCloseNewAppointment}
          onCreated={handleAppointmentCreated}
        />
      )}

      <SystemStatus />
    </>
  );
}
