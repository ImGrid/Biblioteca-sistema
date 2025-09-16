import React, { useState, useEffect } from "react";
import { usersService } from "../../services/users";
import { usePaginatedApi } from "../../hooks/useApi";
import { formatDate, formatCurrency } from "../../utils/formatters";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

export const UsersManagementPage = () => {
  const [filters, setFilters] = useState({
    active_only: false,
    with_fines: false,
  });
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Usando el endpoint de reportes de usuarios disponible en el backend
  const {
    items: users,
    pagination,
    loading,
    error,
    changePage,
    updateParams,
    refresh,
  } = usePaginatedApi(
    usersService.getUsersActivityReport,
    { page: 1, limit: 10, ...filters },
    { immediate: true }
  );

  // Cargar roles disponibles
  useEffect(() => {
    const loadRoles = async () => {
      try {
        setRolesLoading(true);
        const result = await usersService.getRoles();
        if (result.success) {
          setRoles(result.data || []);
        }
      } catch (err) {
        console.error("Error loading roles:", err);
      } finally {
        setRolesLoading(false);
      }
    };

    loadRoles();
  }, []);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    updateParams({ ...newFilters, page: 1 });
  };

  const getStatusBadge = (user) => {
    if (user.status === "active") {
      return "bg-green-100 text-green-800";
    } else if (user.status === "has_fines") {
      return "bg-red-100 text-red-800";
    } else if (user.status === "inactive") {
      return "bg-gray-100 text-gray-800";
    }
    return "bg-blue-100 text-blue-800";
  };

  const getStatusText = (user) => {
    switch (user.status) {
      case "active":
        return "Activo";
      case "has_fines":
        return "Con Multas";
      case "inactive":
        return "Inactivo";
      case "never_borrowed":
        return "Nunca Prestó";
      default:
        return user.status;
    }
  };

  const columns = [
    {
      key: "user_info",
      title: "Usuario",
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">
            {record.first_name} {record.last_name}
          </div>
          <div className="text-sm text-gray-500">{record.email}</div>
          <div className="text-xs text-gray-400">
            Miembro desde: {formatDate(record.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: "activity",
      title: "Actividad",
      render: (_, record) => (
        <div className="text-sm">
          <div>
            Total préstamos:{" "}
            <span className="font-medium">{record.total_loans}</span>
          </div>
          <div>
            Activos:{" "}
            <span className="font-medium text-blue-600">
              {record.active_loans}
            </span>
          </div>
          {record.overdue_loans > 0 && (
            <div>
              Vencidos:{" "}
              <span className="font-medium text-red-600">
                {record.overdue_loans}
              </span>
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
          <div>
            Total: <span className="font-medium">{record.total_fines}</span>
          </div>
          {record.unpaid_fines > 0 && (
            <div className="text-red-600">
              Pendientes: {record.unpaid_fines} -{" "}
              {formatCurrency(record.total_fine_amount)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "last_activity",
      title: "Último Acceso",
      render: (_, record) => (
        <div className="text-sm text-gray-600">
          {record.last_login ? formatDate(record.last_login) : "Nunca"}
        </div>
      ),
    },
    {
      key: "status",
      title: "Estado",
      render: (_, record) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
            record
          )}`}
        >
          {getStatusText(record)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "Acciones",
      render: (_, record) => (
        <div className="text-sm text-gray-500">
          {/* Placeholder para acciones que requerirían endpoints adicionales */}
          <div>ID: {record.id}</div>
          <div className="text-xs">Ver detalles</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Gestión de Usuarios
        </h1>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {/* Estadísticas rápidas */}
      {pagination && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {pagination.total}
            </div>
            <div className="text-sm text-gray-600">Total Usuarios</div>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {users.filter((u) => u.status === "active").length}
            </div>
            <div className="text-sm text-gray-600">Usuarios Activos</div>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {users.filter((u) => u.unpaid_fines > 0).length}
            </div>
            <div className="text-sm text-gray-600">Con Multas</div>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-gray-600">
              {users.filter((u) => u.status === "never_borrowed").length}
            </div>
            <div className="text-sm text-gray-600">Sin Préstamos</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="p-6 bg-white border rounded-lg">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Filtros</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="active_only"
              checked={filters.active_only}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  active_only: e.target.checked,
                })
              }
              className="text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="active_only"
              className="text-sm font-medium text-gray-700"
            >
              Solo usuarios activos (con préstamos actuales)
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="with_fines"
              checked={filters.with_fines}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  with_fines: e.target.checked,
                })
              }
              className="text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="with_fines"
              className="text-sm font-medium text-gray-700"
            >
              Solo usuarios con multas pendientes
            </label>
          </div>
        </div>

        <div className="flex mt-4 space-x-2">
          <Button
            variant="outline"
            onClick={() =>
              handleFilterChange({ active_only: false, with_fines: false })
            }
          >
            Limpiar Filtros
          </Button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando usuarios..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={users}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="No se encontraron usuarios con los filtros seleccionados"
        />
      )}

      {/* Información sobre funcionalidades limitadas */}
      <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
        <h3 className="mb-2 font-medium text-yellow-900">
          Funcionalidades Limitadas:
        </h3>
        <div className="space-y-1 text-sm text-yellow-800">
          <p>
            • Esta vista muestra información de usuarios basada en reportes de
            actividad
          </p>
          <p>
            • Para gestión completa de usuarios (cambiar roles,
            activar/desactivar) se necesitarían endpoints adicionales en el
            backend
          </p>
          <p>
            • Los roles disponibles son: {roles.map((r) => r.label).join(", ")}
          </p>
          <p>
            • Los datos se actualizan según la actividad de préstamos y multas
          </p>
        </div>
      </div>

      {/* Roles disponibles info */}
      {roles.length > 0 && (
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
          <h3 className="mb-2 font-medium text-blue-900">Roles del Sistema:</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {roles.map((role) => (
              <div key={role.value} className="text-sm">
                <div className="font-medium text-blue-800">{role.label}</div>
                <div className="text-blue-700">{role.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default UsersManagementPage;
