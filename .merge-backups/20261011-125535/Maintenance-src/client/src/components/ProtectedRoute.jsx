import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex-center loading-screen">
        <div className="spinner"></div>
        <p>Loading session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
    return (
      <div className="access-denied-container">
        <div className="card text-center">
          <div className="badge badge-urgent mb-4">Access Restricted</div>
          <h2>Permission Denied</h2>
          <p>Your role (<strong>{user.role}</strong>) does not have access to this section.</p>
          <a href="/" className="btn btn-primary mt-4">Return to Dashboard</a>
        </div>
      </div>
    );
  }

  return children;
}
