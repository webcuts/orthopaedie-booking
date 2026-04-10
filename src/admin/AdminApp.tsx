import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks';
import { AdminLayout } from './components';
import { LoginPage, DashboardPage, SettingsPage, DataImportPage, PrescriptionsPage, StaffPage, ActivityLogPage } from './pages';
import { AbsencesPage } from './pages/AbsencesPage';
import './AdminApp.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner" />
        <span>Lade...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

/** Route die nur für Admins zugänglich ist. MFAs und Ärzte werden zum Kalender umgeleitet. */
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, isAdmin, roleLoading } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner" />
        <span>Lade...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/calendar" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

/** Route für Admin + MFA, nicht für Ärzte (z.B. Vorbestellungen) */
function AdminMfaRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, isDoctor, roleLoading } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner" />
        <span>Lade...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (isDoctor) {
    return <Navigate to="/admin/calendar" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner" />
        <span>Lade...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/calendar" replace />;
  }

  return <>{children}</>;
}

export function AdminApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/admin/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Für alle authentifizierten Nutzer (MFA + Admin) */}
        <Route
          path="/admin/calendar"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/prescriptions"
          element={
            <AdminMfaRoute>
              <PrescriptionsPage />
            </AdminMfaRoute>
          }
        />
        <Route
          path="/admin/absences"
          element={
            <ProtectedRoute>
              <AbsencesPage />
            </ProtectedRoute>
          }
        />

        {/* Nur für Admins */}
        <Route
          path="/admin/settings"
          element={
            <AdminOnlyRoute>
              <SettingsPage />
            </AdminOnlyRoute>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <AdminOnlyRoute>
              <ActivityLogPage />
            </AdminOnlyRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <AdminOnlyRoute>
              <StaffPage />
            </AdminOnlyRoute>
          }
        />
        <Route
          path="/admin/import"
          element={
            <AdminOnlyRoute>
              <DataImportPage />
            </AdminOnlyRoute>
          }
        />

        {/* Redirects */}
        <Route path="/admin" element={<Navigate to="/admin/calendar" replace />} />
        <Route path="*" element={<Navigate to="/admin/calendar" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
