// ========== src/pages/fines/MyFinesPage.jsx ==========
import React, { useState } from "react";
import { finesService } from "../../services/fines";
import { usePaginatedApi, useApi } from "../../hooks/useApi";
import { formatDate, formatCurrency, daysSince } from "../../utils/formatters";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Table from "../../components/tables/Table";

const MyFinesPage = () => {
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' o 'history'

  // Hook para multas pendientes
  const {
    items: pendingFines,
    pagination: pendingPagination,
    loading: pendingLoading,
    error: pendingError,
    fetchData: fetchPendingFines,
    changePage: changePendingPage,
    refresh: refreshPending,
  } = usePaginatedApi(
    finesService.getMyFines,
    { page: 1, limit: 10 },
    { immediate: true }
  );

  // Hook para historial de multas
  const {
    items: finesHistory,
    pagination: historyPagination,
    loading: historyLoading,
    error: historyError,
    fetchData: fetchFinesHistory,
    changePage: changeHistoryPage,
  } = usePaginatedApi(
    finesService.getMyHistory,
    { page: 1, limit: 10 },
    { immediate: false }
  );

  // Cargar historial cuando se selecciona la pestaña
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "history" && finesHistory.length === 0) {
      fetchFinesHistory();
    }
  };

  // Obtener información de resumen de multas pendientes
  const getPendingSummary = () => {
    if (!pendingFines || pendingFines.length === 0) {
      return { count: 0, totalAmount: 0 };
    }

    const count = pendingFines.length;
    const totalAmount = pendingFines.reduce(
      (sum, fine) => sum + parseFloat(fine.amount || 0),
      0
    );

    return { count, totalAmount };
  };

  const pendingSummary = getPendingSummary();

  // Columnas para multas pendientes
  const pendingColumns = [
    {
      key: "reason",
      title: "Motivo",
      render: (value, fine) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">
            Generada hace {daysSince(fine.created_at)} días
          </div>
        </div>
      ),
    },
    {
      key: "title",
      title: "Libro",
      render: (value, fine) => (
        <div>
          <div className="font-medium text-gray-800">{value}</div>
          {fine.isbn && (
            <div className="text-sm text-gray-500">ISBN: {fine.isbn}</div>
          )}
        </div>
      ),
    },
    {
      key: "loan_date",
      title: "Préstamo",
      render: (value, fine) => (
        <div className="text-sm">
          <div>Prestado: {formatDate(value)}</div>
          <div>Vencía: {formatDate(fine.due_date)}</div>
        </div>
      ),
    },
    {
      key: "days_overdue",
      title: "Días Vencido",
      render: (value, fine) => (
        <div className="text-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {value || Math.max(0, daysSince(fine.due_date))} días
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      title: "Monto",
      render: (value) => (
        <div className="text-right">
          <span className="text-lg font-bold text-red-600">
            {formatCurrency(value)}
          </span>
        </div>
      ),
    },
  ];

  // Columnas para historial
  const historyColumns = [
    {
      key: "reason",
      title: "Motivo",
      render: (value, fine) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">
            {formatDate(fine.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: "title",
      title: "Libro",
      render: (value, fine) => (
        <div>
          <div className="font-medium text-gray-800">{value}</div>
          {fine.isbn && (
            <div className="text-sm text-gray-500">ISBN: {fine.isbn}</div>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      title: "Monto",
      render: (value) => (
        <div className="text-right font-medium">{formatCurrency(value)}</div>
      ),
    },
    {
      key: "is_paid",
      title: "Estado",
      render: (value, fine) => (
        <div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {value ? "Pagada" : "Pendiente"}
          </span>
          {value && fine.paid_date && (
            <div className="text-xs text-gray-500 mt-1">
              Pagada: {formatDate(fine.paid_date)}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Mis Multas</h1>
        <button
          onClick={() =>
            activeTab === "pending" ? refreshPending() : fetchFinesHistory()
          }
          className="text-sm text-blue-600 hover:text-blue-800"
          disabled={pendingLoading || historyLoading}
        >
          {pendingLoading || historyLoading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* Resumen de multas pendientes */}
      {activeTab === "pending" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg border">
            <div className="text-3xl font-bold text-red-600">
              {pendingSummary.count}
            </div>
            <div className="text-sm text-gray-600">Multas Pendientes</div>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(pendingSummary.totalAmount)}
            </div>
            <div className="text-sm text-gray-600">Total a Pagar</div>
          </div>
        </div>
      )}

      {/* Alerta si hay multas pendientes */}
      {pendingSummary.count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Tienes multas pendientes de pago
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Debes pagar {formatCurrency(pendingSummary.totalAmount)} en
                  multas. Mientras tengas multas pendientes, no podrás solicitar
                  nuevos préstamos.
                </p>
                <p className="mt-1">
                  Contacta a un bibliotecario para procesar el pago.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange("pending")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "pending"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Multas Pendientes ({pendingSummary.count})
          </button>
          <button
            onClick={() => handleTabChange("history")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "history"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Historial de Multas
          </button>
        </nav>
      </div>

      {/* Contenido de las pestañas */}
      {activeTab === "pending" && (
        <div>
          {/* Mensaje de error */}
          {pendingError && <ErrorMessage message={pendingError} />}

          {/* Tabla de multas pendientes */}
          {pendingLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Cargando multas pendientes..." />
            </div>
          ) : (
            <Table
              columns={pendingColumns}
              data={pendingFines}
              pagination={pendingPagination}
              onPageChange={changePendingPage}
              emptyMessage="¡Excelente! No tienes multas pendientes"
              loading={pendingLoading}
            />
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div>
          {/* Mensaje de error */}
          {historyError && <ErrorMessage message={historyError} />}

          {/* Tabla de historial */}
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Cargando historial..." />
            </div>
          ) : (
            <Table
              columns={historyColumns}
              data={finesHistory}
              pagination={historyPagination}
              onPageChange={changeHistoryPage}
              emptyMessage="No tienes historial de multas"
              loading={historyLoading}
            />
          )}
        </div>
      )}

      {/* Información sobre multas */}
      {!pendingLoading && !historyLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">
            Información sobre multas:
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • Las multas se generan automáticamente por cada día de retraso
            </li>
            <li>• El monto de la multa es de $10 pesos por día de retraso</li>
            <li>
              • Las multas deben pagarse con un bibliotecario o administrador
            </li>
            <li>
              • No puedes solicitar nuevos préstamos si tienes multas pendientes
            </li>
            <li>
              • Los pagos se procesan de forma inmediata una vez confirmados
            </li>
          </ul>
        </div>
      )}

      {/* Instrucciones para pagar */}
      {pendingSummary.count > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 mb-2">
            ¿Cómo pagar mis multas?
          </h3>
          <div className="text-sm text-yellow-800 space-y-2">
            <p>
              <strong>1.</strong> Contacta a un bibliotecario o administrador
            </p>
            <p>
              <strong>2.</strong> Menciona que deseas pagar multas pendientes
            </p>
            <p>
              <strong>3.</strong> Proporciona tu número de usuario o email
            </p>
            <p>
              <strong>4.</strong> Realiza el pago por el monto total:{" "}
              <strong>{formatCurrency(pendingSummary.totalAmount)}</strong>
            </p>
            <p>
              <strong>5.</strong> Una vez procesado, podrás solicitar nuevos
              préstamos
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFinesPage;
