import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Import role-specific dashboards
import UserDashboard from './UserDashboard';
import LibrarianDashboard from './LibrarianDashboard';
import AdminDashboard from './AdminDashboard';

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <LoadingSpinner text="Autenticando..." />;
  }

  switch (user?.role) {
    case 'user':
      return <UserDashboard />;
    case 'librarian':
      return <LibrarianDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      // Fallback for when user role is not defined or recognized
      return <div>No se pudo determinar el rol del usuario.</div>;
  }
};

export default DashboardPage;