import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { dashboardService } from "../../services/dashboard";
import {
  formatDate,
  formatCurrency,
  daysSince,
  daysUntil,
} from "../../utils/formatters";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";

const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        let response;

        // Llamar al dashboard apropiado según el rol
        if (user?.role === "admin") {
          response = await dashboardService.getAdminDashboard();
        } else if (user?.role === "librarian") {
          response = await dashboardService.getLibrarianDashboard();
        } else {
          response = await dashboardService.getUserDashboard();
        }

        if (response.success) {
          setDashboardData(response.data);
        } else {
          setError(response.message || "Error al cargar dashboard");
        }
      } catch (error) {
        console.error("Dashboard error:", error);
        setError("Error de conexión al cargar dashboard");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboard();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner size="lg" text="Cargando dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage message={error} onClose={() => setError("")} />
      </div>
    );
  }

  // Dashboard para Usuario Normal - COMPLETO
  if (user?.role === "user") {
    const activeLoans = dashboardData?.current_loans?.active || [];
    const overdueLoans = activeLoans.filter(
      (loan) => loan.status === "overdue" || daysUntil(loan.due_date) < 0
    );
    const dueSoonLoans = activeLoans.filter((loan) => {
      const days = daysUntil(loan.due_date);
      return days >= 0 && days <= 3 && loan.status !== "overdue";
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Mi Dashboard</h1>
          <div className="text-sm text-gray-500">
            Último ingreso:{" "}
            {user.last_login ? formatDate(user.last_login) : "Primera vez"}
          </div>
        </div>

        {/* Alertas importantes */}
        {overdueLoans.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-red-400 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  ¡Tienes {overdueLoans.length} préstamo
                  {overdueLoans.length > 1 ? "s" : ""} vencido
                  {overdueLoans.length > 1 ? "s" : ""}!
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Devuelve los libros lo antes posible para evitar más multas.
                </p>
              </div>
            </div>
          </div>
        )}

        {dueSoonLoans.length > 0 && overdueLoans.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-yellow-400 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Tienes {dueSoonLoans.length} préstamo
                  {dueSoonLoans.length > 1 ? "s" : ""} que vence
                  {dueSoonLoans.length > 1 ? "n" : ""} pronto
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Planifica la devolución o contacta un bibliotecario para
                  extender el plazo.
                </p>
              </div>
            </div>
          </div>
        )}

        {dashboardData?.fines?.pending_count > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-red-400 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path
                    fillRule="evenodd"
                    d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Tienes multas pendientes de pago
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    Total: {formatCurrency(dashboardData.fines.total_amount)} (
                    {dashboardData.fines.pending_count} multa
                    {dashboardData.fines.pending_count > 1 ? "s" : ""})
                  </p>
                </div>
              </div>
              <Link to="/my-fines">
                <Button size="sm" variant="danger">
                  Ver Multas
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Préstamos Activos
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {dashboardData?.current_loans?.count || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <Link
                to="/my-loans"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Ver todos →
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Libros Vencidos
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {overdueLoans.length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Multas Pendientes
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(dashboardData?.fines?.total_amount || 0)}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <svg
                  className="h-6 w-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <Link
                to="/my-fines"
                className="text-sm text-orange-600 hover:text-orange-800"
              >
                Ver multas →
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Histórico
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {dashboardData?.statistics?.total_loans || 0}
                </p>
                <p className="text-xs text-gray-500">libros prestados</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 00-2 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h2a2 2 0 012 2v10"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Préstamos activos - detalle */}
        {activeLoans.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Mis Préstamos Activos
                </h2>
                <Link to="/my-loans">
                  <Button size="sm" variant="outline">
                    Ver Todos
                  </Button>
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {activeLoans.slice(0, 3).map((loan) => {
                  const daysLeft = daysUntil(loan.due_date);
                  const isOverdue = loan.status === "overdue" || daysLeft < 0;
                  const isDueSoon =
                    daysLeft >= 0 && daysLeft <= 3 && !isOverdue;

                  return (
                    <div
                      key={loan.id}
                      className={`border rounded-lg p-4 ${
                        isOverdue
                          ? "border-red-200 bg-red-50"
                          : isDueSoon
                          ? "border-yellow-200 bg-yellow-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {loan.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Autores: {loan.authors || "No especificado"}
                          </p>
                          <p className="text-sm text-gray-500">
                            ISBN: {loan.isbn}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-medium text-gray-900">
                            Vence: {formatDate(loan.due_date)}
                          </p>
                          <p
                            className={`text-sm font-medium ${
                              isOverdue
                                ? "text-red-600"
                                : isDueSoon
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {isOverdue
                              ? `VENCIDO (${Math.abs(daysLeft)} días)`
                              : isDueSoon
                              ? `Vence en ${daysLeft} día${
                                  daysLeft !== 1 ? "s" : ""
                                }`
                              : `${daysLeft} días restantes`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Libros favoritos */}
        {dashboardData?.favorite_books?.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Mis Libros Favoritos
              </h2>
              <p className="text-sm text-gray-600">
                Libros que has prestado más veces
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboardData.favorite_books.slice(0, 4).map((book, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {book.times_borrowed}x
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {book.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {book.authors}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Acciones rápidas */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Acciones Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/books"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">Buscar Libros</p>
                <p className="text-sm text-gray-500">
                  Explora nuestro catálogo
                </p>
              </div>
            </Link>

            <Link
              to="/my-loans"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">Mis Préstamos</p>
                <p className="text-sm text-gray-500">Revisa tus libros</p>
              </div>
            </Link>

            <Link
              to="/profile"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">Mi Perfil</p>
                <p className="text-sm text-gray-500">Actualizar información</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard básico para Librarian y Admin (por ahora)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Dashboard {user?.role === "admin" ? "Administrador" : "Bibliotecario"}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Datos del Sistema
          </h2>
          <p className="text-sm text-gray-600">
            Dashboard completo en Fase 3-4...
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
