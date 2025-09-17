import React, { useState, useMemo } from "react";
import { loansService } from "../../services/loans";
import { usePaginatedApi } from "../../hooks/useApi";
import { useNotification } from "../../context/NotificationContext";
import { formatDate, daysUntil } from "../../utils/formatters";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import CreateLoanForm from "../../components/forms/CreateLoanForm";
import ExtendLoanForm from "../../components/forms/ExtendLoanForm";

export const LoansManagementPage = () => {
  const [filter, setFilter] = useState("active");
  const [isReturning, setIsReturning] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loanToExtend, setLoanToExtend] = useState(null);
  const { success, error: showError } = useNotification();

  const apiFunction = useMemo(() => {
    switch (filter) {
      case "overdue":
        return loansService.getOverdueLoans;
      case "active":
      default:
        return loansService.getActiveLoans;
    }
  }, [filter]);

  const {
    items: loans,
    pagination,
    loading,
    error,
    changePage,
    refresh,
  } = usePaginatedApi(apiFunction, { page: 1, limit: 10 }, { immediate: true });

  const handleReturnLoan = async (loanId) => {
    setIsReturning(loanId);
    try {
      // ✅ CORREGIDO: Agregar segundo parámetro con datos mínimos requeridos
      const result = await loansService.returnLoan(loanId, {
        notes: "",
        condition: "good",
      });
      if (result.success) {
        success("Devolución registrada exitosamente.");
        refresh();
      } else {
        showError(result.message || "Error al registrar la devolución.");
      }
    } catch (err) {
      showError(err.message || "Ocurrió un error de red.");
    } finally {
      setIsReturning(null);
    }
  };

  const handleLoanCreated = () => {
    setIsModalOpen(false);
    refresh();
  };

  const handleExtensionSuccess = () => {
    setLoanToExtend(null);
    refresh();
  };

  const columns = [
    {
      key: "book",
      title: "Libro",
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.title}</div>
          <div className="text-sm text-gray-500">ISBN: {record.isbn}</div>
        </div>
      ),
    },
    {
      key: "user",
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
      key: "dates",
      title: "Fechas",
      render: (_, record) => (
        <div>
          <div className="text-sm">
            <span className="font-medium">Préstamo:</span>{" "}
            {formatDate(record.loan_date)}
          </div>
          <div className="text-sm">
            <span className="font-medium">Vence:</span>{" "}
            {formatDate(record.due_date)}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      title: "Estado",
      render: (_, record) => {
        const days = daysUntil(record.due_date);
        const isOverdue = record.status === "overdue" || days < 0;
        const statusClass = isOverdue
          ? "bg-red-100 text-red-800"
          : days <= 3
          ? "bg-yellow-100 text-yellow-800"
          : "bg-blue-100 text-blue-800";
        const statusText = isOverdue
          ? `Vencido (hace ${Math.abs(days)} días)`
          : days <= 0
          ? "Vence hoy"
          : `Activo (vence en ${days} días)`;

        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
          >
            {statusText}
          </span>
        );
      },
    },
    {
      key: "actions",
      title: "Acciones",
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            onClick={() => handleReturnLoan(record.id)}
            loading={isReturning === record.id}
            disabled={isReturning !== null || !!loanToExtend}
          >
            {isReturning === record.id ? "..." : "Devolución"}
          </Button>
          {filter === "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLoanToExtend(record)}
              disabled={isReturning !== null || !!loanToExtend}
            >
              Extender
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Gestión de Préstamos
        </h1>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          Crear Nuevo Préstamo
        </Button>
      </div>

      {/* Filtros */}
      <div className="p-4 bg-white border rounded-lg">
        <div className="flex items-center space-x-2">
          <Button
            variant={filter === "active" ? "primary" : "outline"}
            onClick={() => setFilter("active")}
          >
            Activos
          </Button>
          <Button
            variant={filter === "overdue" ? "primary" : "outline"}
            onClick={() => setFilter("overdue")}
          >
            Vencidos
          </Button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text={`Cargando préstamos ${filter}...`} />
        </div>
      ) : (
        <Table
          columns={columns}
          data={loans}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="No se encontraron préstamos con los filtros seleccionados."
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <CreateLoanForm
          onSuccess={handleLoanCreated}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>

      {loanToExtend && (
        <Modal isOpen={!!loanToExtend} onClose={() => setLoanToExtend(null)}>
          <ExtendLoanForm
            loan={loanToExtend}
            onSuccess={handleExtensionSuccess}
            onClose={() => setLoanToExtend(null)}
          />
        </Modal>
      )}
    </div>
  );
};
