import React, { useState } from "react";
import { loansService } from "../../services/loans";
import { usePaginatedApi } from "../../hooks/useApi";
import { formatDate, daysSince, daysUntil } from "../../utils/formatters";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Table from "../../components/tables/Table";

const MyLoansPage = () => {
  const [statusFilter, setStatusFilter] = useState("");

  // Hook para préstamos del usuario
  const {
    items: loans,
    pagination,
    loading,
    error,
    fetchData,
    changePage,
    updateParams,
    refresh,
  } = usePaginatedApi(
    loansService.getMyLoans,
    { page: 1, limit: 10 },
    { immediate: true }
  );

  // Manejar cambio de filtro de estado
  const handleStatusChange = (status) => {
    setStatusFilter(status);
    updateParams({ status: status || undefined, page: 1 });
  };

  // Obtener clase CSS para el estado del préstamo
  const getStatusBadgeClass = (loan) => {
    if (loan.status === "returned") {
      return "bg-green-100 text-green-800";
    }
    if (loan.status === "overdue" || loan.days_overdue > 0) {
      return "bg-red-100 text-red-800";
    }
    if (loan.status === "active") {
      const daysLeft = daysUntil(loan.due_date);
      if (daysLeft <= 3 && daysLeft > 0) {
        return "bg-yellow-100 text-yellow-800";
      }
      return "bg-blue-100 text-blue-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  // Obtener texto del estado
  const getStatusText = (loan) => {
    if (loan.status === "returned") {
      return "Devuelto";
    }
    if (loan.status === "overdue" || loan.days_overdue > 0) {
      return `Vencido (${loan.days_overdue} días)`;
    }
    if (loan.status === "active") {
      const daysLeft = daysUntil(loan.due_date);
      if (daysLeft <= 0) {
        return "Vence hoy";
      }
      if (daysLeft <= 3) {
        return `Vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`;
      }
      return "Activo";
    }
    return loan.status;
  };

  // Columnas de la tabla
  const columns = [
    {
      key: "title",
      title: "Libro",
      render: (value, loan) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">
            {loan.isbn && `ISBN: ${loan.isbn}`}
          </div>
          <div className="text-sm text-gray-600">
            {loan.authors && `Autor(es): ${loan.authors}`}
          </div>
        </div>
      ),
    },
    {
      key: "loan_date",
      title: "Fecha Préstamo",
      render: (value) => <div className="text-sm">{formatDate(value)}</div>,
    },
    {
      key: "due_date",
      title: "Fecha Vencimiento",
      render: (value, loan) => (
        <div>
          <div className="text-sm font-medium">{formatDate(value)}</div>
          {loan.status === "active" && (
            <div
              className={`text-xs ${
                daysUntil(value) <= 3 ? "text-red-600" : "text-gray-500"
              }`}
            >
              {daysUntil(value) > 0
                ? `En ${daysUntil(value)} días`
                : daysUntil(value) === 0
                ? "Vence hoy"
                : `Hace ${Math.abs(daysUntil(value))} días`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "return_date",
      title: "Fecha Devolución",
      render: (value, loan) => (
        <div className="text-sm">
          {value ? (
            formatDate(value)
          ) : loan.status === "active" ? (
            <span className="text-gray-500">Pendiente</span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      title: "Estado",
      render: (value, loan) => (
        <div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
              loan
            )}`}
          >
            {getStatusText(loan)}
          </span>
          {loan.pending_fines > 0 && (
            <div className="text-xs text-red-600 mt-1">
              Multa: ${loan.pending_fines}
            </div>
          )}
        </div>
      ),
    },
  ];

  // Estadísticas rápidas
  const getStats = () => {
    const active = loans.filter((loan) => loan.status === "active").length;
    const overdue = loans.filter(
      (loan) => loan.status === "overdue" || loan.days_overdue > 0
    ).length;
    const returned = loans.filter((loan) => loan.status === "returned").length;
    const totalFines = loans.reduce(
      (sum, loan) => sum + (loan.pending_fines || 0),
      0
    );

    return { active, overdue, returned, totalFines };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Mis Préstamos</h1>
        <button
          onClick={refresh}
          className="text-sm text-blue-600 hover:text-blue-800"
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          <div className="text-sm text-gray-600">Préstamos Activos</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-gray-600">Vencidos</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {stats.returned}
          </div>
          <div className="text-sm text-gray-600">Devueltos</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-orange-600">
            ${stats.totalFines.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Multas Pendientes</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleStatusChange("")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === ""
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => handleStatusChange("active")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === "active"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => handleStatusChange("overdue")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === "overdue"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Vencidos
          </button>
          <button
            onClick={() => handleStatusChange("returned")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === "returned"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Devueltos
          </button>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && <ErrorMessage message={error} />}

      {/* Tabla de préstamos */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" text="Cargando préstamos..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={loans}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="No tienes préstamos registrados"
          loading={loading}
        />
      )}

      {/* Información adicional */}
      {!loading && loans.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">
            Información importante:
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Los préstamos tienen una duración de 14 días por defecto</li>
            <li>• Los préstamos vencidos generan multas automáticamente</li>
            <li>
              • Si tienes multas pendientes, no podrás solicitar nuevos
              préstamos
            </li>
            <li>
              • Contacta a un bibliotecario si necesitas extender un préstamo
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MyLoansPage;
