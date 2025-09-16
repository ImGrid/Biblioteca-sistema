import React from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { dashboardService } from '../../services/dashboard';
import { formatDate, formatCurrency, daysUntil } from '../../utils/formatters';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import Button from '../../components/common/Button';

const UserDashboard = () => {
  const { data: dashboardData, loading, error } = useApi(dashboardService.getUserDashboard, { immediate: true });

  if (loading) {
    return <LoadingSpinner text="Cargando tu información..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

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
      <h1 className="text-2xl font-bold text-gray-900">Mi Dashboard</h1>

      {/* Alerts */}
      {overdueLoans.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <p className="text-sm text-red-800">¡Tienes {overdueLoans.length} préstamo(s) vencido(s)! Devuélvelos pronto.</p>
        </div>
      )}
      {dueSoonLoans.length > 0 && overdueLoans.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
            <p className="text-sm text-yellow-800">Tienes {dueSoonLoans.length} préstamo(s) que vencen pronto.</p>
        </div>
      )}
      {dashboardData?.fines?.pending_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex justify-between items-center">
            <p className="text-sm text-red-800">
                Tienes {dashboardData.fines.pending_count} multa(s) pendiente(s) por un total de {formatCurrency(dashboardData.fines.total_amount)}.
            </p>
            <Link to="/my-fines">
                <Button size="sm" variant="danger">Ver Multas</Button>
            </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm font-medium text-gray-600">Préstamos Activos</p>
            <p className="text-2xl font-bold text-blue-600">{dashboardData?.current_loans?.count || 0}</p>
            <Link to="/my-loans" className="text-sm text-blue-600 hover:text-blue-800">Ver todos →</Link>
        </div>
        <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm font-medium text-gray-600">Libros Vencidos</p>
            <p className="text-2xl font-bold text-red-600">{overdueLoans.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm font-medium text-gray-600">Multas Pendientes</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(dashboardData?.fines?.total_amount || 0)}</p>
            <Link to="/my-fines" className="text-sm text-orange-600 hover:text-orange-800">Ver multas →</Link>
        </div>
        <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm font-medium text-gray-600">Total Histórico</p>
            <p className="text-2xl font-bold text-green-600">{dashboardData?.statistics?.total_loans || 0}</p>
            <p className="text-xs text-gray-500">libros prestados</p>
        </div>
      </div>

      {/* Active Loans Details */}
      {activeLoans.length > 0 && (
        <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Mis Préstamos Activos</h2>
                <Link to="/my-loans"><Button size="sm" variant="outline">Ver Todos</Button></Link>
            </div>
            <div className="p-4 space-y-3">
                {activeLoans.slice(0, 3).map(loan => (
                    <div key={loan.id} className="border rounded-lg p-3">
                        <p className="font-medium text-gray-900">{loan.title}</p>
                        <p className="text-sm text-gray-600">Vence: {formatDate(loan.due_date)}</p>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
