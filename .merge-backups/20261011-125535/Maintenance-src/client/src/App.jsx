
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

function AppLayout({ children }) {
  return (
    <div className="flex min-h-svh flex-col bg-mms-surface">
      <Navbar />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-mms-border bg-white py-4">
        <p className="mx-auto max-w-[1120px] px-4 text-center text-xs text-mms-ink-muted lg:px-8">
          © {new Date().getFullYear()} Metropolitan School • Internal Use Only
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
