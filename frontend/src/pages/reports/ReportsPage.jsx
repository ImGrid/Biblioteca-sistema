import React, { useState } from "react";
import { dashboardService } from "../../services/dashboard";
import { useApi } from "../../hooks/useApi";
import { formatDate, formatCurrency } from "../../utils/formatters";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Table from "../../components/tables/Table";

export const ReportsPage = () => {
  const [activeReport, setActiveReport] = useState("monthly");
  const [reportParams, setReportParams] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [usersReportParams, setUsersReportParams] = useState({
    page: 1,
    limit: 50,
    active_only: false,
    with_fines: false,
  });

  // Hook para reporte mensual
  const {
    data: monthlyReport,
    loading: monthlyLoading,
    error: monthlyError,
    execute: generateMonthlyReport,
  } = useApi(dashboardService.getMonthlyReport);

  // Hook para reporte de usuarios
  const {
    data: usersReport,
    loading: usersLoading,
    error: usersError,
    execute: generateUsersReport,
  } = useApi(dashboardService.getUsersActivityReport);

  const handleGenerateMonthly = async () => {
    await generateMonthlyReport(reportParams);
  };

  const handleGenerateUsers = async () => {
    await generateUsersReport(usersReportParams);
  };

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const renderMonthlyReport = () => {
    if (monthlyLoading) {
      return <LoadingSpinner size="lg" text="Generando reporte mensual..." />;
    }

    if (monthlyError) {
      return <ErrorMessage message={monthlyError} />;
    }

    if (!monthlyReport) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">
            Selecciona el mes y año para generar el reporte
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="p-6 bg-white border rounded-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Reporte de {monthNames[monthlyReport.period?.month - 1]}{" "}
            {monthlyReport.period?.year}
          </h3>

          {/* Estadísticas de préstamos */}
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-blue-50">
              <div className="text-2xl font-bold text-blue-600">
                {monthlyReport.loans?.total || 0}
              </div>
              <div className="text-sm text-blue-800">Total Préstamos</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {monthlyReport.loans?.returned || 0}
              </div>
              <div className="text-sm text-green-800">Devueltos</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">
                {monthlyReport.loans?.overdue || 0}
              </div>
              <div className="text-sm text-red-800">Vencidos</div>
            </div>
            <div className="p-4 rounded-lg bg-purple-50">
              <div className="text-2xl font-bold text-purple-600">
                {monthlyReport.loans?.unique_borrowers || 0}
              </div>
              <div className="text-sm text-purple-800">Usuarios Únicos</div>
            </div>
          </div>

          {/* Estadísticas de multas */}
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-orange-50">
              <div className="text-2xl font-bold text-orange-600">
                {monthlyReport.fines?.generated || 0}
              </div>
              <div className="text-sm text-orange-800">Multas Generadas</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {monthlyReport.fines?.paid || 0}
              </div>
              <div className="text-sm text-green-800">Multas Pagadas</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(monthlyReport.fines?.total_amount || 0)}
              </div>
              <div className="text-sm text-red-800">Monto Total</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(monthlyReport.fines?.revenue_collected || 0)}
              </div>
              <div className="text-sm text-green-800">Ingresos</div>
            </div>
          </div>

          {/* Métricas adicionales */}
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-gray-50">
              <div className="text-lg font-bold text-gray-800">
                {monthlyReport.loans?.avg_duration_days || 0} días
              </div>
              <div className="text-sm text-gray-600">Duración Promedio</div>
            </div>
            <div className="p-4 rounded-lg bg-blue-50">
              <div className="text-lg font-bold text-blue-800">
                {monthlyReport.loans?.return_rate || 0}%
              </div>
              <div className="text-sm text-blue-600">Tasa de Devolución</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50">
              <div className="text-lg font-bold text-green-800">
                {monthlyReport.fines?.collection_rate || 0}%
              </div>
              <div className="text-sm text-green-600">Tasa de Cobro</div>
            </div>
          </div>

          {/* Nuevos usuarios */}
          <div className="p-4 rounded-lg bg-purple-50">
            <div className="text-lg font-bold text-purple-800">
              {monthlyReport.new_users || 0}
            </div>
            <div className="text-sm text-purple-600">
              Nuevos Usuarios Registrados
            </div>
          </div>

          {/* Libros más prestados */}
          {monthlyReport.top_books && monthlyReport.top_books.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 font-semibold text-gray-900 text-md">
                Top 10 Libros Más Prestados
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                        Posición
                      </th>
                      <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                        Título
                      </th>
                      <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                        ISBN
                      </th>
                      <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                        Autores
                      </th>
                      <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                        Préstamos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.top_books.map((book, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          #{index + 1}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-800">
                          {book.title}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {book.isbn || "N/A"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {book.authors || "N/A"}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-blue-600">
                          {book.loan_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6 text-xs text-gray-500">
            Reporte generado el: {formatDate(monthlyReport.generated_at)}
          </div>
        </div>
      </div>
    );
  };

  const renderUsersReport = () => {
    if (usersLoading) {
      return (
        <LoadingSpinner size="lg" text="Generando reporte de usuarios..." />
      );
    }

    if (usersError) {
      return <ErrorMessage message={usersError} />;
    }

    if (!usersReport) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">
            Haz clic en "Generar Reporte" para ver la actividad de usuarios
          </p>
        </div>
      );
    }

    const users = usersReport.users || [];
    const summary = usersReport.summary || {};

    const usersColumns = [
      {
        key: "name",
        title: "Usuario",
        render: (_, record) => (
          <div>
            <div className="font-medium text-gray-900">
              {record.first_name} {record.last_name}
            </div>
            <div className="text-sm text-gray-500">{record.email}</div>
          </div>
        ),
      },
      {
        key: "activity",
        title: "Actividad",
        render: (_, record) => (
          <div className="text-sm">
            <div>Total: {record.total_loans}</div>
            <div className="text-blue-600">Activos: {record.active_loans}</div>
            {record.overdue_loans > 0 && (
              <div className="text-red-600">
                Vencidos: {record.overdue_loans}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "fines",
        title: "Multas",
        render: (_, record) => (
          <div className="text-sm">
            <div>Total: {record.total_fines}</div>
            {record.unpaid_fines > 0 && (
              <div className="text-red-600">
                Pendientes: {record.unpaid_fines}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "status",
        title: "Estado",
        render: (_, record) => {
          const statusColors = {
            active: "bg-green-100 text-green-800",
            has_fines: "bg-red-100 text-red-800",
            inactive: "bg-gray-100 text-gray-800",
            never_borrowed: "bg-blue-100 text-blue-800",
          };
          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                statusColors[record.status] || statusColors.inactive
              }`}
            >
              {record.status === "active"
                ? "Activo"
                : record.status === "has_fines"
                ? "Con Multas"
                : record.status === "inactive"
                ? "Inactivo"
                : record.status === "never_borrowed"
                ? "Sin Préstamos"
                : record.status}
            </span>
          );
        },
      },
    ];

    return (
      <div className="space-y-6">
        <div className="p-6 bg-white border rounded-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Reporte de Actividad de Usuarios
          </h3>

          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-blue-50">
              <div className="text-2xl font-bold text-blue-600">
                {summary.total_users || 0}
              </div>
              <div className="text-sm text-blue-800">Total Usuarios</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {summary.active_users || 0}
              </div>
              <div className="text-sm text-green-800">Usuarios Activos</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">
                {summary.users_with_fines || 0}
              </div>
              <div className="text-sm text-red-800">Con Multas</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <div className="text-2xl font-bold text-gray-600">
                {summary.never_borrowed || 0}
              </div>
              <div className="text-sm text-gray-600">Sin Préstamos</div>
            </div>
          </div>

          <Table
            columns={usersColumns}
            data={users}
            pagination={usersReport.pagination}
            emptyMessage="No se encontraron usuarios"
          />

          <div className="mt-6 text-xs text-gray-500">
            Reporte generado el: {formatDate(usersReport.generated_at)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Reportes del Sistema
        </h1>
      </div>

      {/* Selector de reporte */}
      <div className="p-6 bg-white border rounded-lg">
        <div className="flex mb-6 space-x-4">
          <button
            onClick={() => setActiveReport("monthly")}
            className={`px-4 py-2 rounded-md font-medium ${
              activeReport === "monthly"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Reporte Mensual
          </button>
          <button
            onClick={() => setActiveReport("users")}
            className={`px-4 py-2 rounded-md font-medium ${
              activeReport === "users"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Actividad de Usuarios
          </button>
        </div>

        {/* Controles para reporte mensual */}
        {activeReport === "monthly" && (
          <div className="flex items-end space-x-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Año
              </label>
              <Input
                type="number"
                value={reportParams.year}
                onChange={(e) =>
                  setReportParams((prev) => ({
                    ...prev,
                    year: parseInt(e.target.value),
                  }))
                }
                min="2020"
                max={new Date().getFullYear()}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Mes
              </label>
              <select
                value={reportParams.month}
                onChange={(e) =>
                  setReportParams((prev) => ({
                    ...prev,
                    month: parseInt(e.target.value),
                  }))
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {monthNames.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleGenerateMonthly} loading={monthlyLoading}>
              Generar Reporte
            </Button>
          </div>
        )}

        {/* Controles para reporte de usuarios */}
        {activeReport === "users" && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={usersReportParams.active_only}
                  onChange={(e) =>
                    setUsersReportParams((prev) => ({
                      ...prev,
                      active_only: e.target.checked,
                    }))
                  }
                  className="text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Solo usuarios activos
                </span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={usersReportParams.with_fines}
                  onChange={(e) =>
                    setUsersReportParams((prev) => ({
                      ...prev,
                      with_fines: e.target.checked,
                    }))
                  }
                  className="text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Solo con multas</span>
              </label>
            </div>
            <Button onClick={handleGenerateUsers} loading={usersLoading}>
              Generar Reporte de Usuarios
            </Button>
          </div>
        )}
      </div>

      {/* Contenido del reporte */}
      {activeReport === "monthly" && renderMonthlyReport()}
      {activeReport === "users" && renderUsersReport()}
    </div>
  );
};
export default ReportsPage;
