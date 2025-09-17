import React from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { dashboardService } from "../../services/dashboard";
import {
  formatDate,
  formatCurrency,
  daysUntil,
  formatLoanStatus,
} from "../../utils/formatters";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import {
  BookOpen,
  AlertTriangle,
  Clock,
  DollarSign,
  BarChart3,
  CheckCircle,
  Search,
  Calendar,
  User,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

const StatCard = ({ title, value, description, IconComponent, link }) => (
  <div className="p-6 transition-shadow bg-white border rounded-lg shadow-sm hover:shadow-md">
    <div className="flex items-center">
      {IconComponent && (
        <IconComponent className="w-6 h-6 mr-3 text-gray-600" />
      )}
      <div className="flex-1">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="mt-1 text-sm font-medium text-gray-700">{title}</div>
        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </div>
    </div>
    {link && (
      <div className="mt-4">
        <Link
          to={link}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Ver detalles →
        </Link>
      </div>
    )}
  </div>
);

const LoanCard = ({ loan }) => {
  const status = formatLoanStatus(loan);
  const daysLeft = daysUntil(loan.due_date);

  return (
    <div
      className={`p-4 rounded-lg border-l-4 ${
        status.text.includes("Vencido")
          ? "border-red-500 bg-red-50"
          : status.text.includes("hoy") || daysLeft <= 3
          ? "border-yellow-500 bg-yellow-50"
          : "border-blue-500 bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{loan.title}</h4>
          {loan.authors && (
            <p className="mt-1 text-sm text-gray-600">Por: {loan.authors}</p>
          )}
          <div className="flex items-center mt-2 space-x-4 text-sm">
            <span className="flex items-center text-gray-500">
              <Calendar className="w-4 h-4 mr-1" />
              Vence: {formatDate(loan.due_date)}
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                status.text.includes("Vencido")
                  ? "bg-red-100 text-red-800"
                  : status.text.includes("hoy") || daysLeft <= 3
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {status.text}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const BookCard = ({ book, rank }) => (
  <div className="flex items-center p-3 rounded-lg bg-gray-50">
    <div className="mr-3 text-lg font-bold text-gray-600">#{rank}</div>
    <div className="flex-1">
      <div className="text-sm font-medium text-gray-900">{book.title}</div>
      {book.authors && (
        <div className="text-xs text-gray-500">{book.authors}</div>
      )}
      <div className="flex items-center mt-1 text-xs text-gray-600">
        <RefreshCw className="w-3 h-3 mr-1" />
        {book.times_borrowed}{" "}
        {book.times_borrowed === 1 ? "préstamo" : "préstamos"}
      </div>
    </div>
  </div>
);

const UserDashboard = () => {
  const {
    data: dashboardData,
    loading,
    error,
    execute: refreshDashboard,
  } = useApi(dashboardService.getUserDashboard, { immediate: true });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Cargando tu información..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Mi Dashboard</h1>
          <Button onClick={refreshDashboard}>Reintentar</Button>
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  const {
    user = {},
    current_loans = {},
    fines = {},
    statistics = {},
    favorite_books = [],
    recommendations = {},
  } = dashboardData || {};

  const activeLoans = current_loans.active || [];
  const overdueLoans = activeLoans.filter((loan) => loan.status === "overdue");
  const dueSoonLoans = activeLoans.filter((loan) => {
    const days = daysUntil(loan.due_date);
    return days >= 0 && days <= 3 && loan.status !== "overdue";
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center text-3xl font-bold text-gray-900">
            <User className="w-8 h-8 mr-3 text-gray-600" />
            Hola, {user.first_name || "Usuario"}
          </h1>
          <p className="mt-1 text-gray-600">
            Miembro desde {formatDate(user.created_at)} • Último acceso:{" "}
            {user.last_login ? formatDate(user.last_login) : "Primera vez"}
          </p>
        </div>
        <Button variant="outline" onClick={refreshDashboard} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {/* Alertas importantes */}
      {(overdueLoans.length > 0 ||
        dueSoonLoans.length > 0 ||
        fines.pending_count > 0) && (
        <div className="space-y-3">
          {overdueLoans.length > 0 && (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800">
                    Tienes {overdueLoans.length} préstamo
                    {overdueLoans.length > 1 ? "s" : ""} vencido
                    {overdueLoans.length > 1 ? "s" : ""}
                  </h3>
                  <p className="mt-1 text-sm text-red-700">
                    Devuélvelos pronto para evitar multas adicionales.
                  </p>
                  <Link
                    to="/my-loans"
                    className="text-sm font-medium text-red-800 hover:underline"
                  >
                    Ver préstamos vencidos →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {dueSoonLoans.length > 0 && overdueLoans.length === 0 && (
            <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
              <div className="flex items-start">
                <Clock className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">
                    {dueSoonLoans.length} préstamo
                    {dueSoonLoans.length > 1 ? "s" : ""} vence
                    {dueSoonLoans.length > 1 ? "n" : ""} pronto
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Planifica devolverlos o contacta para renovar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {fines.pending_count > 0 && (
            <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start">
                  <DollarSign className="w-5 h-5 text-orange-600 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-orange-800">
                      Multas pendientes: {formatCurrency(fines.total_amount)}
                    </h3>
                    <p className="mt-1 text-sm text-orange-700">
                      {fines.pending_count} multa
                      {fines.pending_count > 1 ? "s" : ""} sin pagar
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
        </div>
      )}

      {/* Estadísticas principales */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Mi Actividad
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Préstamos Activos"
            value={current_loans.count || 0}
            description={`Máximo ${user.max_loans || 3} permitidos`}
            IconComponent={BookOpen}
            link="/my-loans"
          />

          <StatCard
            title="Libros Vencidos"
            value={current_loans.overdue_count || 0}
            description={
              overdueLoans.length > 0 ? "Requiere atención" : "Excelente"
            }
            IconComponent={
              overdueLoans.length > 0 ? AlertTriangle : CheckCircle
            }
            link="/my-loans?status=overdue"
          />

          <StatCard
            title="Multas Pendientes"
            value={formatCurrency(fines.total_amount || 0)}
            description={`${fines.pending_count || 0} multa${
              fines.pending_count === 1 ? "" : "s"
            }`}
            IconComponent={DollarSign}
            link="/my-fines"
          />

          <StatCard
            title="Total Histórico"
            value={statistics.total_loans || 0}
            description={`${
              statistics.returned_loans || 0
            } devueltos • Promedio ${statistics.avg_loan_days || 0} días`}
            IconComponent={BarChart3}
            link="/my-loans"
          />
        </div>
      </div>

      {/* Préstamos activos detallados */}
      {activeLoans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Mis Préstamos Activos
            </h2>
            <Link to="/my-loans">
              <Button size="sm" variant="outline">
                Ver Todos
              </Button>
            </Link>
          </div>
          <div className="space-y-4">
            {activeLoans.slice(0, 5).map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
            {activeLoans.length > 5 && (
              <div className="py-4 text-center">
                <Link to="/my-loans">
                  <Button variant="outline">
                    Ver {activeLoans.length - 5} préstamos más
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Libros favoritos */}
      {favorite_books.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Mis Libros Favoritos
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {favorite_books.slice(0, 6).map((book, index) => (
              <BookCard key={index} book={book} rank={index + 1} />
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              to="/books"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Explorar más libros en el catálogo →
            </Link>
          </div>
        </div>
      )}

      {/* Footer stats */}
      {activeLoans.length === 0 && fines.pending_count === 0 && (
        <div className="py-8 text-center border border-green-200 rounded-lg bg-green-50">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
          <h3 className="text-lg font-semibold text-green-800">Todo al día</h3>
          <p className="mt-1 text-green-700">
            No tienes préstamos pendientes ni multas
          </p>
          <Link to="/books" className="inline-block mt-4">
            <Button>Explorar Libros</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
