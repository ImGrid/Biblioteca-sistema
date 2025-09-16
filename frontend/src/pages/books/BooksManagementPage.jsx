import React, { useState } from "react";
import { booksService } from "../../services/books";
import { usePaginatedApi } from "../../hooks/useApi";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";

const BooksManagementPage = () => {

  const {
    items: books,
    pagination,
    loading,
    error,
    changePage,
    refresh,
  } = usePaginatedApi(booksService.getAllBooks, { page: 1, limit: 10 }, { immediate: true });

  const handleCreate = () => {
    alert("Abrir modal para crear libro...");
  };

  const handleEdit = (book) => {
    alert(`Editar libro ID: ${book.id} - ${book.title}`);
  };

  const handleDelete = (book) => {
    alert(`Eliminar libro ID: ${book.id} - ${book.title}`);
  };

  const columns = [
    {
      key: "title",
      title: "Título",
      render: (title, record) => (
        <div>
          <div className="font-medium text-gray-900">{title}</div>
          <div className="text-sm text-gray-500">{record.authors}</div>
        </div>
      ),
    },
    {
      key: "isbn",
      title: "ISBN",
    },
    {
      key: "copies",
      title: "Copias",
      render: (_, record) => (
        <div>
          <div>Total: {record.total_copies}</div>
          <div className="text-green-600">Disponibles: {record.available_copies}</div>
        </div>
      ),
    },
    {
        key: "publication_year",
        title: "Año",
    },
    {
      key: "actions",
      title: "Acciones",
      render: (_, record) => (
        <div className="flex space-x-2">
            <Button size="sm" variant="outline" onClick={() => handleEdit(record)}>Editar</Button>
            <Button size="sm" variant="danger_outline" onClick={() => handleDelete(record)}>Eliminar</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Libros</h1>
        <Button variant="primary" onClick={handleCreate}>
            Crear Nuevo Libro
        </Button>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando libros..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={books}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="No se encontraron libros."
        />
      )}
    </div>
  );
};

export default BooksManagementPage;