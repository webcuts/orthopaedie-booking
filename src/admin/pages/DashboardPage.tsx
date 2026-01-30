import { useState, useCallback } from 'react';
import { CalendarView, AppointmentModal } from '../components';
import { type AppointmentWithDetails } from '../hooks';

export function DashboardPage() {
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAppointmentClick = useCallback((appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedAppointment(null);
  }, []);

  const handleStatusUpdate = useCallback(() => {
    // Trigger calendar refresh
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <CalendarView
        key={refreshKey}
        onAppointmentClick={handleAppointmentClick}
      />

      {selectedAppointment && (
        <AppointmentModal
          appointment={selectedAppointment}
          onClose={handleCloseModal}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </>
  );
}
