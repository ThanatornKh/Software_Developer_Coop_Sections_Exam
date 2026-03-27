import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VehicleListPage from './pages/VehicleListPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import DriverListPage from './pages/DriverListPage';
import TripListPage from './pages/TripListPage';
import TripCreatePage from './pages/TripCreatePage';
import TripDetailPage from './pages/TripDetailPage';
import MaintenancePage from './pages/MaintenancePage';
import AuditLogPage from './pages/AuditLogPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/vehicles" element={<VehicleListPage />} />
          <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
          <Route path="/drivers" element={<DriverListPage />} />
          <Route path="/trips" element={<TripListPage />} />
          <Route path="/trips/create" element={<TripCreatePage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/audit-logs" element={<AuditLogPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
