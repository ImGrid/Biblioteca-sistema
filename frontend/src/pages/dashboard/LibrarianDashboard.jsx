import React from 'react';
import { useApi } from '../../hooks/useApi';
import { dashboardService } from '../../services/dashboard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

const StatCard = ({ title, value, description }) => (
  <div className="bg-white p-6 rounded-lg border">
    <div className="text-3xl font-bold text-blue-600">{value}</div>
    <div className="text-sm font-medium text-gray-800 mt-1">{title}</div>
    {description && <p className="text-xs text-gray-500 mt-2">{description}</p>}
  </div>
);

const LibrarianDashboard = () => {
  const { data, loading, error } = useApi(dashboardService.getLibrarianDashboard, { immediate: true });

  if (loading) {
    return <LoadingSpinner text="Cargando datos del dashboard..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard del Bibliotecario</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
                title="Préstamos Hoy" 
                value={data?.loans_today || 0} 
                description="Préstamos registrados en las últimas 24 horas."
            />
            <StatCard 
                title="Devoluciones Hoy" 
                value={data?.returns_today || 0} 
                description="Libros devueltos en las últimas 24 horas."
            />
            <StatCard 
                title="Préstamos Vencidos" 
                value={data?.overdue_loans || 0} 
                description="Préstamos que no han sido devueltos a tiempo."
            />
            <StatCard 
                title="Multas Pendientes" 
                value={data?.pending_fines || 0} 
                description="Total de multas que aún no han sido pagadas."
            />
        </div>
        {/* Aquí se podrían añadir más componentes, como listas de préstamos recientes o vencidos */}
    </div>
  );
};

export default LibrarianDashboard;
