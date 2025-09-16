import React, { useState, useEffect } from "react";
import { booksService } from "../../services/books";
import { categoriesService } from "../../services/categories";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Table from "../../components/tables/Table";

const BookCatalogPage = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Hook para búsqueda paginada de libros
  const {
    items: books,
    pagination,
    loading,
    error,
    fetchData,
    changePage,
    updateParams,
  } = usePaginatedApi(
    booksService.searchBooks,
    { page: 1, limit: 10, available_only: true },
    { immediate: true }
  );

  // Cargar categorías al montar el componente
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        const response = await categoriesService.getCategories();
        if (response.success) {
          setCategories(response.data || []);
        }
      } catch (error) {
        console.error("Error loading categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Manejar búsqueda
  const handleSearch = (e) => {
    e.preventDefault();
    const searchParams = {
      q: searchTerm.trim() || undefined,
      category: selectedCategory || undefined,
      available_only: availableOnly,
      page: 1,
    };
    updateParams(searchParams);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setAvailableOnly(true);
    updateParams({ page: 1, available_only: true });
  };

  // Columnas de la tabla
  const columns = [
    {
      key: "title",
      title: "Título",
      render: (value, book) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {book.isbn && (
            <div className="text-sm text-gray-500">ISBN: {book.isbn}</div>
          )}
        </div>
      ),
    },
    {
      key: "authors",
      title: "Autores",
      render: (value) => (
        <div className="text-sm text-gray-700">
          {value || "Sin autor especificado"}
        </div>
      ),
    },
    {
      key: "category_name",
      title: "Categoría",
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {value || "Sin categoría"}
        </span>
      ),
    },
    {
      key: "publication_year",
      title: "Año",
      render: (value) => value || "N/A",
    },
    {
      key: "available_copies",
      title: "Disponibles",
      render: (value, book) => (
        <div className="text-center">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              value > 0
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {value} / {book.total_copies}
          </span>
          <div className="text-xs text-gray-500 mt-1">
            {value > 0 ? "Disponible" : "No disponible"}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de Libros</h1>
        <div className="text-sm text-gray-500">
          {user?.role === "user"
            ? "Solo libros disponibles"
            : "Catálogo completo"}
        </div>
      </div>

      {/* Formulario de búsqueda */}
      <div className="bg-white p-6 rounded-lg border">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Buscar libro"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Título, autor, ISBN..."
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={categoriesLoading}
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {user?.role !== "user" && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="available_only"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="mr-2"
                />
                <label
                  htmlFor="available_only"
                  className="text-sm text-gray-700"
                >
                  Solo disponibles
                </label>
              </div>
            )}
          </div>

          <div className="flex space-x-4">
            <Button type="submit" loading={loading}>
              Buscar
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Limpiar Filtros
            </Button>
          </div>
        </form>
      </div>

      {/* Mensaje de error */}
      {error && <ErrorMessage message={error} />}

      {/* Tabla de resultados */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" text="Buscando libros..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={books}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="No se encontraron libros con los criterios de búsqueda"
          loading={loading}
        />
      )}

      {/* Resumen de resultados */}
      {!loading && books.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-blue-800 text-sm">
            <strong>Resultados:</strong> {pagination.total} libros encontrados
            {searchTerm && ` para "${searchTerm}"`}
            {selectedCategory &&
              categories.find((c) => c.id == selectedCategory) &&
              ` en categoría "${
                categories.find((c) => c.id == selectedCategory)?.name
              }"`}
          </p>
        </div>
      )}
    </div>
  );
};

export default BookCatalogPage;
