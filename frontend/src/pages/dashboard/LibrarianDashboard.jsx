import React from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { dashboardService } from "../../services/dashboard";
import {
  formatDate,
  formatCurrency,
  formatPhone,
} from "../../utils/formatters";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import {
  BookOpen,
  CheckCircle,
  DollarSign,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Search,
  RotateCcw,
  CreditCard,
  Plus,
} from "lucide-react";

const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  link,
  urgent = false,
}) => (
  <div
    className={`bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-all ${
      urgent ? "border-red-200 bg-red-50" : ""
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        {Icon && (
          <Icon
            className={`w-6 h-6 mr-4 ${
              urgent ? "text-red-600" : "text-gray-600"
            }`}
          />
        )}
        <div>
          <div
            className={`text-3xl font-bold ${
              urgent ? "text-red-700" : "text-gray-900"
            }`}
          >
            {value}
          </div>
          <div
            className={`text-sm font-medium ${
              urgent ? "text-red-800" : "text-gray-700"
            } mt-1`}
          >
            {title}
          </div>
          {description && (
            <p
              className={`text-xs ${
                urgent ? "text-red-600" : "text-gray-500"
              } mt-1`}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {urgent && <AlertTriangle className="w-5 h-5 text-red-500" />}
    </div>
    {link && (
      <div className="mt-4">
        <Link
          to={link}
          className={`text-sm font-medium hover:underline ${
            urgent
              ? "text-red-700 hover:text-red-800"
              : "text-blue-600 hover:text-blue-800"
          }`}
        >
          {urgent ? "Revisar ahora" : "Ver detalles"} →
        </Link>
      </div>
    )}
  </div>
);

const UrgentLoanCard = ({ loan, type = "overdue" }) => (
  <div
    className={`p-4 rounded-lg border-l-4 ${
      type === "overdue"
        ? "border-red-500 bg-red-50"
        : "border-yellow-500 bg-yellow-50"
    }`}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <h4 className="font-semibold text-gray-900">{loan.title}</h4>
          {loan.isbn && (
            <span className="text-xs text-gray-500">({loan.isbn})</span>
          )}
        </div>

        <div className="mt-2 text-sm">
          <div className="flex items-center font-medium text-gray-800">
            <Users className="w-4 h-4 mr-1" />
            {loan.first_name} {loan.last_name}
          </div>
          <div className="flex items-center mt-1 text-gray-600">
            <Mail className="w-4 h-4 mr-1" />
            {loan.email}
          </div>
          {loan.phone && (
            <div className="flex items-center mt-1 text-gray-600">
              <Phone className="w-4 h-4 mr-1" />
              {formatPhone(loan.phone)}
            </div>
          )}
        </div>

        <div className="flex items-center mt-3 space-x-4 text-sm">
          <span
            className={`flex items-center ${
              type === "overdue"
                ? "text-red-600 font-medium"
                : "text-yellow-600 font-medium"
            }`}
          >
            <Calendar className="w-4 h-4 mr-1" />
            {type === "overdue"
              ? `Vencido hace ${loan.days_overdue} días`
              : `Vence: ${formatDate(loan.due_date)}`}
          </span>
          {loan.fine_amount > 0 && (
            <span className="flex items-center font-medium text-orange-600">
              <DollarSign className="w-4 h-4 mr-1" />
              Multa: {formatCurrency(loan.fine_amount)}
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);

const PendingFineCard = ({ fine }) => (
  <div className="p-4 border-l-4 border-orange-500 rounded-lg bg-orange-50">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900">{fine.title}</h4>
          <span className="text-lg font-bold text-orange-600">
            {formatCurrency(fine.amount)}
          </span>
        </div>

        <div className="mt-2 text-sm">
          <div className="flex items-center font-medium text-gray-800">
            <Users className="w-4 h-4 mr-1" />
            {fine.first_name} {fine.last_name}
          </div>
          <div className="text-gray-600">{fine.email}</div>
          <div className="mt-1 text-orange-700">{fine.reason}</div>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Generada: {formatDate(fine.created_at)}
        </div>
      </div>
    </div>
  </div>
);

const PopularBookCard = ({ book, rank }) => (
  <div className="flex items-center p-3 border rounded-lg bg-gray-50">
    <div className="mr-3 text-lg font-bold text-gray-600">#{rank}</div>
    <div className="flex-1">
      <div className="text-sm font-semibold text-gray-900">{book.title}</div>
      {book.authors && (
        <div className="mt-1 text-xs text-gray-600">{book.authors}</div>
      )}
      {book.isbn && (
        <div className="text-xs text-gray-500">ISBN: {book.isbn}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded-full">
          {book.loan_count} préstamos esta semana
        </span>
      </div>
    </div>
  </div>
);

const LibrarianDashboard = () => {
  const {
    data: dashboardData,
    loading,
    error,
    execute: refreshDashboard,
  } = useApi(dashboardService.getLibrarianDashboard, { immediate: true });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Cargando centro de control..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Centro de Control - Biblioteca
          </h1>
          <Button onClick={refreshDashboard}>Reintentar</Button>
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  const {
    today = {},
    urgent_tasks = {},
    weekly_summary = {},
    notifications = {},
  } = dashboardData || {};

  const hasUrgentTasks =
    (urgent_tasks.overdue_count || 0) > 0 ||
    (urgent_tasks.pending_fines_count || 0) > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Centro de Control - Biblioteca
          </h1>
          <p className="mt-1 text-gray-600">
            {formatDate(new Date())} •
            {hasUrgentTasks ? (
              <span className="ml-2 font-medium text-red-600">
                {notifications.pending_actions || 0} acciones pendientes
              </span>
            ) : (
              <span className="ml-2 font-medium text-green-600">
                Todo bajo control
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          <Link to="/loans">
            <Button variant="outline">Gestionar Préstamos</Button>
          </Link>
          <Button
            variant="outline"
            onClick={refreshDashboard}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* Alerta crítica si hay tareas urgentes */}
      {hasUrgentTasks && (
        <div className="p-4 border-l-4 border-red-500 rounded-lg bg-red-50">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 mr-3 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">
                Atención requerida
              </h3>
              <p className="mt-1 text-red-700">
                {urgent_tasks.overdue_count > 0 &&
                  `${urgent_tasks.overdue_count} préstamos vencidos`}
                {urgent_tasks.overdue_count > 0 &&
                  urgent_tasks.pending_fines_count > 0 &&
                  " • "}
                {urgent_tasks.pending_fines_count > 0 &&
                  `${urgent_tasks.pending_fines_count} multas por procesar`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas del día */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Actividad de Hoy
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Préstamos Hoy"
            value={today.loans || 0}
            description="Libros prestados en las últimas 24h"
            icon={BookOpen}
            link="/loans"
          />

          <StatCard
            title="Devoluciones Hoy"
            value={today.returns || 0}
            description="Libros devueltos en las últimas 24h"
            icon={CheckCircle}
            link="/loans"
          />

          <StatCard
            title="Pagos Procesados"
            value={today.payments || 0}
            description="Multas cobradas hoy"
            icon={DollarSign}
            link="/fines"
          />

          <StatCard
            title="Vencen Hoy"
            value={notifications.due_today_count || 0}
            description="Préstamos que vencen hoy"
            icon={Clock}
            link="/loans?filter=due_today"
            urgent={notifications.due_today_count > 0}
          />
        </div>
      </div>

      {/* Tareas urgentes */}
      {hasUrgentTasks && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Tareas Urgentes
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StatCard
              title="Préstamos Vencidos"
              value={urgent_tasks.overdue_count || 0}
              description="Requieren seguimiento inmediato"
              icon={AlertTriangle}
              link="/loans?filter=overdue"
              urgent={urgent_tasks.overdue_count > 0}
            />

            <StatCard
              title="Multas Pendientes"
              value={urgent_tasks.pending_fines_count || 0}
              description="Por procesar pago"
              icon={DollarSign}
              link="/fines"
              urgent={urgent_tasks.pending_fines_count > 0}
            />
          </div>
        </div>
      )}

      {/* Préstamos vencidos detalle */}
      {urgent_tasks.overdue_loans && urgent_tasks.overdue_loans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-red-800">
              Préstamos Vencidos
            </h2>
            <Link to="/loans?filter=overdue">
              <Button variant="danger" size="sm">
                Ver Todos ({urgent_tasks.overdue_loans.length})
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {urgent_tasks.overdue_loans.slice(0, 5).map((loan, index) => (
              <UrgentLoanCard key={index} loan={loan} type="overdue" />
            ))}
          </div>
        </div>
      )}

      {/* Vencen hoy */}
      {today.due_today && today.due_today.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-yellow-800">
              Vencen Hoy
            </h2>
            <span className="text-sm text-yellow-700">
              {today.due_today.length} préstamo
              {today.due_today.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {today.due_today.slice(0, 3).map((loan, index) => (
              <UrgentLoanCard key={index} loan={loan} type="due_today" />
            ))}
          </div>
        </div>
      )}

      {/* Multas pendientes detalle */}
      {urgent_tasks.pending_fines && urgent_tasks.pending_fines.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-orange-800">
              Multas por Procesar
            </h2>
            <Link to="/fines">
              <Button variant="outline" size="sm">
                Procesar Pagos
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {urgent_tasks.pending_fines.slice(0, 5).map((fine, index) => (
              <PendingFineCard key={index} fine={fine} />
            ))}
          </div>
        </div>
      )}

      {/* Resumen semanal */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Resumen de la Semana
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Préstamos"
            value={weekly_summary.loans || 0}
            description="Esta semana"
            icon={BookOpen}
          />

          <StatCard
            title="Devoluciones"
            value={weekly_summary.returns || 0}
            description="Esta semana"
            icon={CheckCircle}
          />

          <StatCard
            title="Multas Generadas"
            value={weekly_summary.fines_generated || 0}
            description="Esta semana"
            icon={AlertTriangle}
          />

          <StatCard
            title="Ingresos"
            value={formatCurrency(weekly_summary.revenue || 0)}
            description="Esta semana"
            icon={TrendingUp}
          />
        </div>
      </div>

      {/* Libros populares de la semana */}
      {weekly_summary.popular_books &&
        weekly_summary.popular_books.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Libros Más Populares (Esta Semana)
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {weekly_summary.popular_books.slice(0, 6).map((book, index) => (
                <PopularBookCard key={index} book={book} rank={index + 1} />
              ))}
            </div>
          </div>
        )}

      {/* Acciones rápidas */}
      <div className="p-6 border rounded-lg bg-gray-50">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Acciones Rápidas
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link to="/loans" className="block">
            <div className="p-4 transition-shadow bg-white border rounded-lg cursor-pointer hover:shadow-md">
              <div className="text-center">
                <Plus className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                <div className="font-medium text-gray-900">Nuevo Préstamo</div>
                <div className="text-sm text-gray-600">Registrar préstamo</div>
              </div>
            </div>
          </Link>

          <Link to="/loans?filter=active" className="block">
            <div className="p-4 transition-shadow bg-white border rounded-lg cursor-pointer hover:shadow-md">
              <div className="text-center">
                <RotateCcw className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                <div className="font-medium text-gray-900">
                  Procesar Devolución
                </div>
                <div className="text-sm text-gray-600">
                  Registrar devolución
                </div>
              </div>
            </div>
          </Link>

          <Link to="/fines" className="block">
            <div className="p-4 transition-shadow bg-white border rounded-lg cursor-pointer hover:shadow-md">
              <div className="text-center">
                <CreditCard className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                <div className="font-medium text-gray-900">Procesar Pago</div>
                <div className="text-sm text-gray-600">Cobrar multas</div>
              </div>
            </div>
          </Link>

          <Link to="/books" className="block">
            <div className="p-4 transition-shadow bg-white border rounded-lg cursor-pointer hover:shadow-md">
              <div className="text-center">
                <Search className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                <div className="font-medium text-gray-900">Buscar Libros</div>
                <div className="text-sm text-gray-600">Consultar catálogo</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Estado del sistema */}
      {!hasUrgentTasks && (
        <div className="py-8 text-center border border-green-200 rounded-lg bg-green-50">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
          <h3 className="text-lg font-semibold text-green-800">
            Sistema bajo control
          </h3>
          <p className="mt-1 text-green-700">
            No hay tareas urgentes pendientes
          </p>
          <div className="flex justify-center mt-4 space-x-4">
            <Link to="/loans">
              <Button variant="outline">Ver Préstamos</Button>
            </Link>
            <Link to="/books">
              <Button>Explorar Catálogo</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibrarianDashboard;
