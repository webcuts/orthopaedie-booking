import { useState, useCallback } from 'react';
import { CalendarView, AppointmentModal, NewAppointmentModal } from '../components';
import { type AppointmentWithDetails } from '../hooks';

export function DashboardPage() {
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
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

  return (
    <>
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
        />
      )}

      {showNewAppointment && (
        <NewAppointmentModal
          onClose={handleCloseNewAppointment}
          onCreated={handleAppointmentCreated}
        />
      )}
    </>
  );
}
