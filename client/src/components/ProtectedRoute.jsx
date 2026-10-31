import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LOGIN = { patient: '/login', doctor: '/doctor/login', admin: '/admin/login', organization: '/organization/login' };
const HOME = { patient: '/dashboard', doctor: '/doctor/dashboard', admin: '/admin/dashboard', organization: '/organization/dashboard' };

export const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
    <div className="spinner" aria-hidden="true" />
    <span className="sr-only">Loading…</span>
  </div>
);

// Only renders children when the visitor holds a valid session for `role`.
export const ProtectedRoute = ({ role, children }) => {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <PageLoader />;
  if (!auth[role]) return <Navigate to={LOGIN[role]} replace state={{ from: location.pathname }} />;
  return children;
};

// Login / register pages: signed-in users are sent to their dashboard instead.
export const GuestRoute = ({ role, children }) => {
  const auth = useAuth();
  if (auth.loading) return <PageLoader />;
  if (auth[role]) return <Navigate to={HOME[role]} replace />;
  return children;
};
