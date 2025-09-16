import React, { useState } from "react";
import { booksService } from "../../services/books";
import { usePaginatedApi } from "../../hooks/useApi";
import { useNotification } from "../../context/NotificationContext";
import { formatDate } from "../../utils/formatters";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import BookForm from "../../components/forms/BookForm";

const BooksManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookToEdit, setBookToEdit] = useState(null);
  const { success, error: showError } = useNotification();

  const {
    items: books,
    pagination,
    loading,
    error,
    changePage,
    refresh,
  } = usePaginatedApi(
    booksService.getAllBooks,
    { page: 1, limit: 10 },
    { immediate: true }
  );

  const handleCreateSuccess = () => {
    setIsModalOpen(false);
    refresh();
  };

  const handleEditSuccess = () => {
    setBookToEdit(null);
    refresh();
  };

  const handleDelete = async (book) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar el libro "${book.title}"?\n\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      const result = await booksService.deleteBook(book.id);
      if (result.success) {
        success("Libro eliminado exitosamente");
        refresh();
      } else {
        showError(result.message || "No se pudo eliminar el libro");
      }
    } catch (err) {
      showError(
        err.response?.data?.error?.message || "Error al eliminar libro"
      );
    }
  };

  const columns = [
    {
      key: "title",
      title: "Libro",
      render: (title, record) => (
        <div>
          <div className="font-medium text-gray-900">{title}</div>
          <div className="text-sm text-gray-500">
            {record.authors || "Sin autor"}
          </div>
          {record.isbn && (
            <div className="text-sm text-gray-500">ISBN: {record.isbn}</div>
          )}
        </div>
      ),
    },
    {
      key: "category_name",
      title: "Categoría",
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {value || "Sin categoría"}
        </span>
      ),
    },
    {
      key: "publication_info",
      title: "Publicación",
      render: (_, record) => (
        <div className="text-sm">
          {record.publisher && <div>{record.publisher}</div>}
          {record.publication_year && <div>{record.publication_year}</div>}
        </div>
      ),
    },
    {
      key: "copies",
      title: "Copias",
      render: (_, record) => (
        <div className="text-center">
          <div className="text-sm font-medium">
            {record.available_copies}/{record.total_copies}
          </div>
          <div
            className={`text-xs ${
              record.available_copies > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {record.available_copies > 0 ? "Disponible" : "No disponible"}
          </div>
        </div>
      ),
    },
    {
      key: "location",
      title: "Ubicación",
      render: (value) => (
        <div className="text-sm text-gray-600">
          {value || "No especificada"}
        </div>
      ),
    },
    {
      key: "created_at",
      title: "Fecha Creación",
      render: (value) => <div className="text-sm">{formatDate(value)}</div>,
    },
    {
      key: "actions",
      title: "Acciones",
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBookToEdit(record)}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(record)}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Libros</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            Crear Nuevo Libro
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {pagination?.total || 0}
          </div>
          <div className="text-sm text-gray-600">Total Libros</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {books.reduce((sum, book) => sum + (book.available_copies || 0), 0)}
          </div>
          <div className="text-sm text-gray-600">Copias Disponibles</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {books.reduce((sum, book) => sum + (book.total_copies || 0), 0)}
          </div>
          <div className="text-sm text-gray-600">Total Copias</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            {books.filter((book) => (book.available_copies || 0) === 0).length}
          </div>
          <div className="text-sm text-gray-600">Sin Disponibilidad</div>
        </div>
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

      {/* Modal Crear */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <BookForm
          onSuccess={handleCreateSuccess}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Modal Editar */}
      {bookToEdit && (
        <Modal isOpen={!!bookToEdit} onClose={() => setBookToEdit(null)}>
          <BookForm
            book={bookToEdit}
            onSuccess={handleEditSuccess}
            onClose={() => setBookToEdit(null)}
          />
        </Modal>
      )}

      {/* Information panel */}
      {!loading && books.length > 0 && (
        <div className="p-4 rounded-lg bg-gray-50">
          <h3 className="mb-2 font-medium text-gray-900">Información:</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Los libros eliminados mantienen su historial de préstamos</li>
            <li>• No se pueden eliminar libros con préstamos activos</li>
            <li>
              • Las copias disponibles se actualizan automáticamente con los
              préstamos
            </li>
            <li>• Cada libro debe tener al menos una categoría y un autor</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default BooksManagementPage;
