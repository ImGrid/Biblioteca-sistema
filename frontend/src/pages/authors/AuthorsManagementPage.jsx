import React, { useState } from "react";
import { authorsService } from "../../services/authors";
import { usePaginatedApi } from "../../hooks/useApi";
import { useNotification } from "../../context/NotificationContext";
import { formatDate } from "../../utils/formatters";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";

// Formulario para crear/editar autor
const AuthorForm = ({ author, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: author?.first_name || "",
    last_name: author?.last_name || "",
    bio: author?.bio || "",
    birth_date: author?.birth_date || "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    // Validaciones básicas
    const newErrors = {};
    if (!formData.first_name.trim())
      newErrors.first_name = "Nombre es requerido";
    if (!formData.last_name.trim())
      newErrors.last_name = "Apellido es requerido";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const result = author
        ? await authorsService.updateAuthor(author.id, formData)
        : await authorsService.createAuthor(formData);

      if (result.success) {
        success(
          author
            ? "Autor actualizado exitosamente"
            : "Autor creado exitosamente"
        );
        onSuccess();
      } else {
        showError(result.message || "Error al procesar autor");
      }
    } catch (err) {
      showError(err.response?.data?.error?.message || "Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {author ? "Editar Autor" : "Crear Nuevo Autor"}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Nombre"
          value={formData.first_name}
          onChange={handleChange("first_name")}
          error={errors.first_name}
          required
        />
        <Input
          label="Apellido"
          value={formData.last_name}
          onChange={handleChange("last_name")}
          error={errors.last_name}
          required
        />
      </div>

      <Input
        label="Fecha de Nacimiento"
        type="date"
        value={formData.birth_date}
        onChange={handleChange("birth_date")}
        error={errors.birth_date}
      />

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Biografía
        </label>
        <textarea
          rows={4}
          value={formData.bio}
          onChange={handleChange("bio")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Información sobre el autor..."
        />
      </div>

      <div className="flex justify-end pt-4 space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {author ? "Actualizar" : "Crear"} Autor
        </Button>
      </div>
    </form>
  );
};

export const AuthorsManagementPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authorToEdit, setAuthorToEdit] = useState(null);
  const { success, error: showError } = useNotification();

  const {
    items: authors,
    pagination,
    loading,
    error,
    changePage,
    updateParams,
    refresh,
  } = usePaginatedApi(
    authorsService.getAuthors,
    { page: 1, limit: 10 },
    { immediate: true }
  );

  const handleSearch = (e) => {
    e.preventDefault();
    updateParams({ search: searchTerm.trim() || undefined, page: 1 });
  };

  const handleCreateSuccess = () => {
    setIsModalOpen(false);
    refresh();
  };

  const handleEditSuccess = () => {
    setAuthorToEdit(null);
    refresh();
  };

  const handleDelete = async (author) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar al autor "${author.first_name} ${author.last_name}"?`
      )
    ) {
      return;
    }

    try {
      const result = await authorsService.deleteAuthor(author.id);
      if (result.success) {
        success("Autor eliminado exitosamente");
        refresh();
      } else {
        showError(result.message || "No se pudo eliminar el autor");
      }
    } catch (err) {
      showError(
        err.response?.data?.error?.message || "Error al eliminar autor"
      );
    }
  };

  const columns = [
    {
      key: "name",
      title: "Nombre Completo",
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">
            {record.first_name} {record.last_name}
          </div>
          {record.birth_date && (
            <div className="text-sm text-gray-500">
              Nacido: {formatDate(record.birth_date)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "bio",
      title: "Biografía",
      render: (value) => (
        <div className="max-w-xs text-sm text-gray-600">
          {value ? (
            <span title={value}>
              {value.length > 100 ? `${value.substring(0, 100)}...` : value}
            </span>
          ) : (
            <span className="text-gray-400">Sin biografía</span>
          )}
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
            onClick={() => setAuthorToEdit(record)}
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
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Autores</h1>
        <Button onClick={() => setIsModalOpen(true)}>Crear Nuevo Autor</Button>
      </div>

      {/* Búsqueda */}
      <div className="p-6 bg-white border rounded-lg">
        <form onSubmit={handleSearch} className="flex space-x-4">
          <Input
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button type="submit">Buscar</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              updateParams({ search: undefined, page: 1 });
            }}
          >
            Limpiar
          </Button>
        </form>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando autores..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={authors}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="No se encontraron autores"
        />
      )}

      {/* Modal Crear */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <AuthorForm
          onSuccess={handleCreateSuccess}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Modal Editar */}
      {authorToEdit && (
        <Modal isOpen={!!authorToEdit} onClose={() => setAuthorToEdit(null)}>
          <AuthorForm
            author={authorToEdit}
            onSuccess={handleEditSuccess}
            onClose={() => setAuthorToEdit(null)}
          />
        </Modal>
      )}
    </div>
  );
};

export default AuthorsManagementPage;
