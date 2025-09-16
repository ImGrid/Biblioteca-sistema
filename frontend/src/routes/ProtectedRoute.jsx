import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";

const ProtectedRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // No autenticado - redirigir a login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar roles si se especificaron
  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600">Acceso Denegado</h1>
          <p className="text-gray-600 mt-2">
            No tienes permisos para acceder a esta página
          </p>
          <p className="text-sm text-gray-500 mt-1">Tu rol: {user.role}</p>
          <p className="text-sm text-gray-500">
            Roles requeridos: {roles.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
