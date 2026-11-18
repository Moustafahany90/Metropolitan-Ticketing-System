import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TicketsPage from "@/pages/TicketsPage";
import NewTicketPage from "@/pages/NewTicketPage";
import TicketDetailPage from "@/pages/TicketDetailPage";
import MaintenanceDashboardPage from "@/pages/maintenance/MaintenanceDashboardPage";
import ModuleSelectPage from "@/pages/ModuleSelectPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/select" element={<ModuleSelectPage />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/new" element={<NewTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/maintenance" element={<MaintenanceDashboardPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/select" replace />} />
          <Route path="*" element={<Navigate to="/select" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
