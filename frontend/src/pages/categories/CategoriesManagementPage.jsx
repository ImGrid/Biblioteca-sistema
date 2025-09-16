import React, { useState } from "react";
import { categoriesService } from "../../services/categories";
import { useNotification } from "../../context/NotificationContext";
import { formatDate } from "../../utils/formatters";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";

// Formulario para crear/editar categoría
const CategoryForm = ({ category, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    description: category?.description || "",
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
    if (!formData.name.trim()) newErrors.name = "Nombre es requerido";
    if (formData.name.trim().length < 2)
      newErrors.name = "El nombre debe tener al menos 2 caracteres";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const result = category
        ? await categoriesService.updateCategory(category.id, formData)
        : await categoriesService.createCategory(formData);

      if (result.success) {
        success(
          category
            ? "Categoría actualizada exitosamente"
            : "Categoría creada exitosamente"
        );
        onSuccess();
      } else {
        showError(result.message || "Error al procesar categoría");
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
          {category ? "Editar Categoría" : "Crear Nueva Categoría"}
        </h2>
      </div>

      <Input
        label="Nombre"
        value={formData.name}
        onChange={handleChange("name")}
        error={errors.name}
        placeholder="Ej: Ficción, Historia, Ciencia..."
        required
      />

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Descripción
        </label>
        <textarea
          rows={3}
          value={formData.description}
          onChange={handleChange("description")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Descripción de la categoría (opcional)..."
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
          {category ? "Actualizar" : "Crear"} Categoría
        </Button>
      </div>
    </form>
  );
};

export const CategoriesManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const { success, error: showError } = useNotification();

  // Usando categoriesService.getCategories directamente sin paginación
  // porque el backend no parece tener paginación para categorías
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await categoriesService.getCategories();
      if (result.success) {
        setCategories(result.data || []);
      } else {
        setError(result.message || "Error al cargar categorías");
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  // Cargar categorías al montar componente
  React.useEffect(() => {
    loadCategories();
  }, []);

  const handleCreateSuccess = () => {
    setIsModalOpen(false);
    loadCategories();
  };

  const handleEditSuccess = () => {
    setCategoryToEdit(null);
    loadCategories();
  };

  const handleDelete = async (category) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar la categoría "${category.name}"?\n\nEsto puede afectar los libros asociados.`
      )
    ) {
      return;
    }

    try {
      const result = await categoriesService.deleteCategory(category.id);
      if (result.success) {
        success("Categoría eliminada exitosamente");
        loadCategories();
      } else {
        showError(result.message || "No se pudo eliminar la categoría");
      }
    } catch (err) {
      showError(
        err.response?.data?.error?.message || "Error al eliminar categoría"
      );
    }
  };

  const columns = [
    {
      key: "name",
      title: "Nombre",
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">
            {record.books_count || 0} libro(s) •{" "}
            {record.available_books_count || 0} disponible(s)
          </div>
        </div>
      ),
    },
    {
      key: "description",
      title: "Descripción",
      render: (value) => (
        <div className="max-w-md text-sm text-gray-600">
          {value ? (
            <span title={value}>
              {value.length > 150 ? `${value.substring(0, 150)}...` : value}
            </span>
          ) : (
            <span className="text-gray-400">Sin descripción</span>
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
            onClick={() => setCategoryToEdit(record)}
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
        <h1 className="text-2xl font-bold text-gray-900">
          Gestión de Categorías
        </h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadCategories} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            Crear Nueva Categoría
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {categories.length}
          </div>
          <div className="text-sm text-gray-600">Total Categorías</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {categories.reduce((sum, cat) => sum + (cat.books_count || 0), 0)}
          </div>
          <div className="text-sm text-gray-600">Total Libros</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {categories.reduce(
              (sum, cat) => sum + (cat.available_books_count || 0),
              0
            )}
          </div>
          <div className="text-sm text-gray-600">Libros Disponibles</div>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando categorías..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={categories}
          emptyMessage="No se encontraron categorías"
        />
      )}

      {/* Modal Crear */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <CategoryForm
          onSuccess={handleCreateSuccess}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Modal Editar */}
      {categoryToEdit && (
        <Modal
          isOpen={!!categoryToEdit}
          onClose={() => setCategoryToEdit(null)}
        >
          <CategoryForm
            category={categoryToEdit}
            onSuccess={handleEditSuccess}
            onClose={() => setCategoryToEdit(null)}
          />
        </Modal>
      )}

      {/* Información adicional */}
      {!loading && categories.length > 0 && (
        <div className="p-4 rounded-lg bg-gray-50">
          <h3 className="mb-2 font-medium text-gray-900">Información:</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Las categorías organizan los libros en el catálogo</li>
            <li>
              • No se puede eliminar una categoría que tiene libros asociados
            </li>
            <li>
              • Los usuarios pueden filtrar libros por categoría en el catálogo
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
export default CategoriesManagementPage;
