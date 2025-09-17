import React from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { dashboardService } from "../../services/dashboard";
import { formatDate, formatCurrency } from "../../utils/formatters";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import {
  Users,
  BookOpen,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  FileText,
  Settings,
  BarChart3,
} from "lucide-react";

const StatCard = ({ title, value, description, icon: Icon, link }) => (
  <div className="p-6 bg-white border rounded-lg">
    <div className="flex items-center">
      {Icon && <Icon className="w-6 h-6 mr-3 text-gray-600" />}
      <div className="flex-1">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="mt-1 text-sm font-medium text-gray-700">{title}</div>
        {description && (
          <p className="mt-2 text-xs text-gray-500">{description}</p>
        )}
      </div>
    </div>
    {link && (
      <Link
        to={link}
        className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800"
      >
        Ver detalles →
      </Link>
    )}
  </div>
);

const AdminDashboard = () => {
  const {
    data: dashboardData,
    loading,
    error,
    execute: refreshDashboard,
  } = useApi(dashboardService.getAdminDashboard, { immediate: true });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Cargando dashboard administrativo..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard del Administrador
          </h1>
          <Button onClick={refreshDashboard}>Reintentar</Button>
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  const {
    system_overview = {},
    financial = {},
    monthly_activity = {},
    top_performers = {},
    trends = {},
    alerts = {},
  } = dashboardData || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard del Administrador
        </h1>
        <Button variant="outline" onClick={refreshDashboard} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {/* Alertas críticas */}
      {(alerts.overdue_loans > 0 || alerts.unpaid_fines > 0) && (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
            <div>
              <h3 className="mb-2 font-medium text-red-900">
                Alertas del Sistema
              </h3>
              <div className="grid grid-cols-1 gap-2 text-sm text-red-800 md:grid-cols-2">
                {alerts.overdue_loans > 0 && (
                  <div>• {alerts.overdue_loans} préstamos vencidos</div>
                )}
                {alerts.unpaid_fines > 0 && (
                  <div>• {alerts.unpaid_fines} multas sin pagar</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumen del sistema */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Resumen del Sistema
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Usuarios"
            value={system_overview.users || 0}
            description="Usuarios activos registrados"
            icon={Users}
            link="/admin/users"
          />
          <StatCard
            title="Total Libros"
            value={system_overview.books || 0}
            description={`${system_overview.total_copies || 0} copias totales`}
            icon={BookOpen}
            link="/admin/books"
          />
          <StatCard
            title="Préstamos Activos"
            value={system_overview.active_loans || 0}
            description={`${system_overview.overdue_loans || 0} vencidos`}
            icon={FileText}
            link="/loans"
          />
          <StatCard
            title="Tasa de Utilización"
            value={`${system_overview.utilization_rate || 0}%`}
            description="Copias en préstamo vs totales"
            icon={BarChart3}
          />
        </div>
      </div>

      {/* Estadísticas financieras */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Estado Financiero
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Multas Pendientes"
            value={financial.unpaid_fines_count || 0}
            description={`${formatCurrency(
              financial.unpaid_amount || 0
            )} por cobrar`}
            icon={AlertTriangle}
            link="/fines"
          />
          <StatCard
            title="Ingresos del Mes"
            value={formatCurrency(financial.monthly_revenue || 0)}
            description="Multas cobradas este mes"
            icon={DollarSign}
          />
          <StatCard
            title="Ingresos Totales"
            value={formatCurrency(financial.total_revenue || 0)}
            description={`Promedio: ${formatCurrency(financial.avg_fine || 0)}`}
            icon={TrendingUp}
          />
          <StatCard
            title="Total Multas"
            value={financial.total_fines || 0}
            description="Multas generadas históricamente"
            icon={FileText}
          />
        </div>
      </div>

      {/* Actividad mensual */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Actividad Este Mes
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title="Nuevos Préstamos"
            value={monthly_activity.loans || 0}
            description="Préstamos registrados este mes"
            icon={BookOpen}
          />
          <StatCard
            title="Devoluciones"
            value={monthly_activity.returns || 0}
            description="Libros devueltos este mes"
            icon={FileText}
          />
          <StatCard
            title="Nuevos Usuarios"
            value={monthly_activity.new_users || 0}
            description="Registros nuevos este mes"
            icon={Users}
          />
        </div>
      </div>

      {/* Top performers y tendencias */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top libros */}
        <div className="p-6 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Top 5 Libros
            </h3>
            <Link
              to="/admin/reports"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver reporte completo →
            </Link>
          </div>
          <div className="space-y-3">
            {(top_performers.books || []).slice(0, 5).map((book, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded bg-gray-50"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {book.title}
                  </div>
                  <div className="text-xs text-gray-500">{book.authors}</div>
                </div>
                <div className="text-sm font-bold text-gray-700">
                  {book.total_loans} préstamos
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top usuarios */}
        <div className="p-6 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Usuarios Más Activos
            </h3>
            <Link
              to="/admin/users"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Gestionar usuarios →
            </Link>
          </div>
          <div className="space-y-3">
            {(top_performers.users || []).slice(0, 5).map((user, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded bg-gray-50"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-700">
                    {user.total_loans} préstamos
                  </div>
                  {user.active_loans > 0 && (
                    <div className="text-xs text-gray-500">
                      {user.active_loans} activos
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categorías populares */}
      {top_performers.categories && top_performers.categories.length > 0 && (
        <div className="p-6 bg-white border rounded-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Categorías Más Populares
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {top_performers.categories.map((category, index) => (
              <div key={index} className="p-3 text-center rounded bg-gray-50">
                <div className="text-lg font-bold text-gray-700">
                  {category.loan_count}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {category.name}
                </div>
                <div className="text-xs text-gray-500">
                  {category.unique_books} libros
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendencias */}
      {trends.loan_history && trends.loan_history.length > 0 && (
        <div className="p-6 bg-white border rounded-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Tendencia de Préstamos (6 meses)
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {trends.loan_history.map((item, index) => (
              <div key={index} className="p-3 text-center rounded bg-gray-50">
                <div className="text-lg font-bold text-gray-700">
                  {item.loan_count}
                </div>
                <div className="text-xs text-gray-600">{item.month}</div>
                <div className="text-xs text-gray-500">
                  {item.unique_users} usuarios
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="p-6 border rounded-lg bg-gray-50">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Link to="/admin/books">
            <Button variant="outline" className="w-full">
              Gestionar Libros
            </Button>
          </Link>
          <Link to="/admin/users">
            <Button variant="outline" className="w-full">
              Gestionar Usuarios
            </Button>
          </Link>
          <Link to="/admin/reports">
            <Button variant="outline" className="w-full">
              Ver Reportes
            </Button>
          </Link>
          <Link to="/loans">
            <Button variant="outline" className="w-full">
              Ver Préstamos
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer con info */}
      <div className="text-xs text-center text-gray-500">
        Dashboard actualizado automáticamente • Datos en tiempo real
      </div>
    </div>
  );
};

export default AdminDashboard;
