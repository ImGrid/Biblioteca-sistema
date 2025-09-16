import React, { useState, useEffect } from "react";
import { booksService } from "../../services/books";
import { authorsService } from "../../services/authors";
import { categoriesService } from "../../services/categories";
import { useNotification } from "../../context/NotificationContext";
import Button from "../common/Button";
import Input from "../common/Input";
import LoadingSpinner from "../common/LoadingSpinner";

const BookForm = ({ book, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: book?.title || "",
    isbn: book?.isbn || "",
    publisher: book?.publisher || "",
    publication_year: book?.publication_year || "",
    category_id: book?.category_id || "",
    total_copies: book?.total_copies || "1",
    description: book?.description || "",
    location: book?.location || "",
    author_ids: book?.author_ids || [],
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para opciones
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [selectedAuthors, setSelectedAuthors] = useState([]);

  const { success, error: showError } = useNotification();

  // Cargar categorías y autores al montar
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const [categoriesResult, authorsResult] = await Promise.all([
          categoriesService.getCategories(),
          authorsService.getAuthors({ limit: 100 }), // Obtener más autores
        ]);

        if (categoriesResult.success) {
          setCategories(categoriesResult.data || []);
        }

        if (authorsResult.success) {
          setAuthors(authorsResult.data || []);

          // Si estamos editando, cargar autores seleccionados
          if (book && book.authors) {
            // Parsear autores del string "Nombre Apellido, Nombre2 Apellido2"
            const authorNames = book.authors.split(", ");
            const bookAuthors = authorsResult.data.filter((author) =>
              authorNames.some(
                (name) => name === `${author.first_name} ${author.last_name}`
              )
            );
            setSelectedAuthors(bookAuthors);
            setFormData((prev) => ({
              ...prev,
              author_ids: bookAuthors.map((a) => a.id),
            }));
          }
        }
      } catch (err) {
        showError("Error al cargar datos del formulario");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [book]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    // Validaciones básicas
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = "Título es requerido";
    if (!formData.category_id) newErrors.category_id = "Categoría es requerida";
    if (!formData.author_ids.length)
      newErrors.author_ids = "Debe seleccionar al menos un autor";
    if (parseInt(formData.total_copies) < 1)
      newErrors.total_copies = "Debe tener al menos 1 copia";

    if (
      formData.publication_year &&
      (isNaN(formData.publication_year) || formData.publication_year < 1000)
    ) {
      newErrors.publication_year = "Año de publicación inválido";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        category_id: parseInt(formData.category_id),
        total_copies: parseInt(formData.total_copies),
        publication_year: formData.publication_year
          ? parseInt(formData.publication_year)
          : null,
      };

      const result = book
        ? await booksService.updateBook(book.id, submitData)
        : await booksService.createBook(submitData);

      if (result.success) {
        success(
          book ? "Libro actualizado exitosamente" : "Libro creado exitosamente"
        );
        onSuccess();
      } else {
        showError(result.message || "Error al procesar libro");
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

  const handleAuthorToggle = (author) => {
    const isSelected = selectedAuthors.some((a) => a.id === author.id);

    if (isSelected) {
      const newSelected = selectedAuthors.filter((a) => a.id !== author.id);
      setSelectedAuthors(newSelected);
      setFormData((prev) => ({
        ...prev,
        author_ids: newSelected.map((a) => a.id),
      }));
    } else {
      const newSelected = [...selectedAuthors, author];
      setSelectedAuthors(newSelected);
      setFormData((prev) => ({
        ...prev,
        author_ids: newSelected.map((a) => a.id),
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="Cargando formulario..." />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 overflow-y-auto max-h-96"
    >
      <div>
        <h2 className="text-xl font-semibold">
          {book ? "Editar Libro" : "Crear Nuevo Libro"}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Título"
          value={formData.title}
          onChange={handleChange("title")}
          error={errors.title}
          required
        />
        <Input
          label="ISBN"
          value={formData.isbn}
          onChange={handleChange("isbn")}
          error={errors.isbn}
          placeholder="Opcional"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Editorial"
          value={formData.publisher}
          onChange={handleChange("publisher")}
          error={errors.publisher}
        />
        <Input
          label="Año de Publicación"
          type="number"
          value={formData.publication_year}
          onChange={handleChange("publication_year")}
          error={errors.publication_year}
          min="1000"
          max={new Date().getFullYear()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Categoría <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.category_id}
            onChange={handleChange("category_id")}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.category_id ? "border-red-300" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <p className="mt-1 text-sm text-red-600">{errors.category_id}</p>
          )}
        </div>

        <Input
          label="Total de Copias"
          type="number"
          value={formData.total_copies}
          onChange={handleChange("total_copies")}
          error={errors.total_copies}
          min="1"
          required
        />
      </div>

      <Input
        label="Ubicación"
        value={formData.location}
        onChange={handleChange("location")}
        error={errors.location}
        placeholder="Ej: Estante A3, Sección Historia"
      />

      {/* Selección de autores */}
      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Autores <span className="text-red-500">*</span>
        </label>
        <div className="p-3 overflow-y-auto border border-gray-300 rounded-md max-h-32">
          {authors.length > 0 ? (
            <div className="space-y-1">
              {authors.map((author) => (
                <label key={author.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedAuthors.some((a) => a.id === author.id)}
                    onChange={() => handleAuthorToggle(author)}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {author.first_name} {author.last_name}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay autores disponibles</p>
          )}
        </div>
        {errors.author_ids && (
          <p className="mt-1 text-sm text-red-600">{errors.author_ids}</p>
        )}
        {selectedAuthors.length > 0 && (
          <p className="mt-1 text-sm text-gray-600">
            Seleccionados:{" "}
            {selectedAuthors
              .map((a) => `${a.first_name} ${a.last_name}`)
              .join(", ")}
          </p>
        )}
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Descripción
        </label>
        <textarea
          rows={3}
          value={formData.description}
          onChange={handleChange("description")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Descripción del libro (opcional)..."
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
          {book ? "Actualizar" : "Crear"} Libro
        </Button>
      </div>
    </form>
  );
};

export default BookForm;
