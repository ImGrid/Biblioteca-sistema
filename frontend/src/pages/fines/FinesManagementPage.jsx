import React, { useState } from "react";
import { finesService } from "../../services/fines";
import { usePaginatedApi } from "../../hooks/useApi";
import { formatDate, formatCurrency } from "../../utils/formatters";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import ProcessPaymentForm from "../../components/forms/ProcessPaymentForm";

export const FinesManagementPage = () => {
  const [fineToPay, setFineToPay] = useState(null);

  const {
    items: fines,
    pagination,
    loading,
    error,
    changePage,
    refresh,
  } = usePaginatedApi(finesService.getPendingFines, { page: 1, limit: 10 }, { immediate: true });

  const handlePaymentSuccess = () => {
    setFineToPay(null);
    refresh();
  };

  const columns = [
    {
      key: "user",
      title: "Usuario",
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.first_name} {record.last_name}</div>
          <div className="text-sm text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      key: "book",
      title: "Libro",
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.title}</div>
          <div className="text-sm text-gray-500">Préstamo del: {formatDate(record.loan_date)}</div>
        </div>
      ),
    },
    {
      key: "reason",
      title: "Motivo",
      render: (value, record) => (
        <div>
            <div>{value}</div>
            <div className="text-sm text-red-600">Vencido hace {record.days_overdue} días</div>
        </div>
      )
    },
    {
        key: "amount",
        title: "Monto",
        render: (value) => (
            <span className="font-bold text-lg text-red-700">{formatCurrency(value)}</span>
        )
    },
    {
      key: "actions",
      title: "Acciones",
      render: (_, record) => (
        <Button
          size="sm"
          onClick={() => setFineToPay(record)}>
          Procesar Pago
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Multas</h1>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando multas pendientes..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={fines}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="¡Excelente! No hay multas pendientes por procesar."
        />
      )}

      {fineToPay && (
        <Modal isOpen={!!fineToPay} onClose={() => setFineToPay(null)}>
          <ProcessPaymentForm 
            fine={fineToPay}
            onSuccess={handlePaymentSuccess} 
            onClose={() => setFineToPay(null)} 
          />
        </Modal>
      )}
    </div>
  );
};