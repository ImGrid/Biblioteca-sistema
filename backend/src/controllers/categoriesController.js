const { CATEGORIES_QUERIES } = require("../config/queries");
const { executeQuery, executeQuerySingle } = require("../utils/database");
const { validateString, validateId } = require("../utils/validation");
const { asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Validación específica para datos de categoría
const validateCategoryData = (data) => {
  const errors = {};
  const validatedData = {};

  // Name
  const nameValidation = validateString(data.name, "Nombre", {
    minLength: 2,
    maxLength: 100,
  });
  if (!nameValidation.valid) {
    errors.name = nameValidation.error;
  } else {
    validatedData.name = nameValidation.value;
  }

  // Description (opcional)
  if (data.description !== undefined) {
    const descriptionValidation = validateString(
      data.description,
      "Descripción",
      {
        required: false,
        maxLength: 500,
      }
    );
    if (!descriptionValidation.valid) {
      errors.description = descriptionValidation.error;
    } else {
      validatedData.description = descriptionValidation.value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Listar categorías (acceso público para usuarios autenticados)
const getCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await executeQuery(
      CATEGORIES_QUERIES.LIST_CATEGORIES,
      [],
      "Get all categories"
    );

    if (!categories.success) {
      logger.error("Error getting categories:", categories.error);
      return res.serverError("Error al obtener categorías");
    }

    // Agregar estadísticas de libros por categoría
    const categoriesWithStats = await Promise.all(
      categories.data.map(async (category) => {
        const booksCount = await executeQuerySingle(
          "SELECT COUNT(*) as count FROM books WHERE category_id = $1",
          [category.id],
          "Count books by category"
        );

        const availableCount = await executeQuerySingle(
          "SELECT COUNT(*) as count FROM books WHERE category_id = $1 AND available_copies > 0",
          [category.id],
          "Count available books by category"
        );

        return {
          ...category,
          books_count: booksCount.success ? parseInt(booksCount.data.count) : 0,
          available_books_count: availableCount.success
            ? parseInt(availableCount.data.count)
            : 0,
        };
      })
    );

    res.success(categoriesWithStats, "Categorías obtenidas exitosamente");
  } catch (error) {
    logger.error("Get categories error:", error.message);
    res.serverError("Error al obtener categorías");
  }
});

// Obtener categoría por ID (acceso público para usuarios autenticados)
const getCategoryById = asyncHandler(async (req, res) => {
  const categoryIdValidation = validateId(req.params.id, "ID de la categoría");

  if (!categoryIdValidation.valid) {
    return res.validationError({ id: categoryIdValidation.error });
  }

  try {
    const category = await executeQuerySingle(
      "SELECT id, name, description, created_at FROM categories WHERE id = $1",
      [categoryIdValidation.value],
      "Get category by ID"
    );

    if (!category.success) {
      logger.error("Error getting category by ID:", category.error);
      return res.serverError("Error al obtener categoría");
    }

    if (!category.data) {
      return res.notFound("Categoría");
    }

    // Obtener libros de la categoría (solo los disponibles para usuarios normales)
    const booksQuery =
      req.user.role === "admin" || req.user.role === "librarian"
        ? `
                SELECT b.id, b.title, b.isbn, b.publication_year, b.total_copies, b.available_copies,
                       STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
                FROM books b
                LEFT JOIN book_authors ba ON b.id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.id
                WHERE b.category_id = $1
                GROUP BY b.id, b.title, b.isbn, b.publication_year, b.total_copies, b.available_copies
                ORDER BY b.title
              `
        : `
                SELECT b.id, b.title, b.isbn, b.publication_year, b.available_copies,
                       STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
                FROM books b
                LEFT JOIN book_authors ba ON b.id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.id
                WHERE b.category_id = $1 AND b.available_copies > 0
                GROUP BY b.id, b.title, b.isbn, b.publication_year, b.available_copies
                ORDER BY b.title
              `;

    const books = await executeQuery(
      booksQuery,
      [categoryIdValidation.value],
      "Get books by category"
    );

    const categoryData = {
      ...category.data,
      books: books.success ? books.data : [],
    };

    res.success(categoryData, "Categoría obtenida exitosamente");
  } catch (error) {
    logger.error("Get category by ID error:", error.message);
    res.serverError("Error al obtener categoría");
  }
});

// Crear categoría (solo admin)
const createCategory = asyncHandler(async (req, res) => {
  const validation = validateCategoryData(req.body);

  if (!validation.valid) {
    return res.validationError(
      validation.errors,
      "Datos de la categoría inválidos"
    );
  }

  const { name, description } = validation.data;

  // Verificar que no exista una categoría con el mismo nombre
  const existingCategory = await executeQuerySingle(
    CATEGORIES_QUERIES.CHECK_CATEGORY_EXISTS,
    [name],
    "Check category exists"
  );

  if (!existingCategory.success) {
    return res.serverError("Error al verificar categoría existente");
  }

  if (existingCategory.data) {
    return res.conflict("Ya existe una categoría con este nombre");
  }

  try {
    const newCategory = await executeQuerySingle(
      CATEGORIES_QUERIES.CREATE_CATEGORY,
      [name, description],
      "Create category"
    );

    if (!newCategory.success) {
      logger.error("Error creating category:", newCategory.error);
      return res.serverError("Error al crear categoría");
    }

    logger.audit(
      "Category created successfully",
      {
        category_id: newCategory.data.id,
        category_name: name,
        created_by: req.user.id,
      },
      req
    );

    res.created(newCategory.data, "Categoría creada exitosamente");
  } catch (error) {
    logger.error("Create category error:", error.message);
    res.serverError("Error al crear categoría");
  }
});

// Actualizar categoría (solo admin)
const updateCategory = asyncHandler(async (req, res) => {
  const categoryIdValidation = validateId(req.params.id, "ID de la categoría");

  if (!categoryIdValidation.valid) {
    return res.validationError({ id: categoryIdValidation.error });
  }

  const validation = validateCategoryData(req.body);

  if (!validation.valid) {
    return res.validationError(
      validation.errors,
      "Datos de la categoría inválidos"
    );
  }

  const { name, description } = validation.data;

  // Verificar que la categoría existe
  const existingCategory = await executeQuerySingle(
    "SELECT id, name FROM categories WHERE id = $1",
    [categoryIdValidation.value],
    "Check category exists for update"
  );

  if (!existingCategory.success || !existingCategory.data) {
    return res.notFound("Categoría");
  }

  // Verificar nombre único (excluyendo la categoría actual)
  const nameExists = await executeQuerySingle(
    "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2",
    [name, categoryIdValidation.value],
    "Check category name unique for update"
  );

  if (!nameExists.success) {
    return res.serverError("Error al verificar nombre de categoría");
  }

  if (nameExists.data) {
    return res.conflict("Ya existe otra categoría con este nombre");
  }

  try {
    const updateQuery = `
            UPDATE categories 
            SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, name, description, updated_at
        `;

    const updatedCategory = await executeQuerySingle(
      updateQuery,
      [name, description, categoryIdValidation.value],
      "Update category"
    );

    if (!updatedCategory.success) {
      logger.error("Error updating category:", updatedCategory.error);
      return res.serverError("Error al actualizar categoría");
    }

    logger.audit(
      "Category updated successfully",
      {
        category_id: categoryIdValidation.value,
        category_name: name,
        updated_by: req.user.id,
      },
      req
    );

    res.success(updatedCategory.data, "Categoría actualizada exitosamente");
  } catch (error) {
    logger.error("Update category error:", error.message);
    res.serverError("Error al actualizar categoría");
  }
});

// Eliminar categoría (solo admin)
const deleteCategory = asyncHandler(async (req, res) => {
  const categoryIdValidation = validateId(req.params.id, "ID de la categoría");

  if (!categoryIdValidation.valid) {
    return res.validationError({ id: categoryIdValidation.error });
  }

  // Verificar que la categoría existe
  const existingCategory = await executeQuerySingle(
    "SELECT id, name FROM categories WHERE id = $1",
    [categoryIdValidation.value],
    "Check category exists for delete"
  );

  if (!existingCategory.success || !existingCategory.data) {
    return res.notFound("Categoría");
  }

  // Verificar que no tiene libros asociados
  const categoryBooks = await executeQuerySingle(
    "SELECT COUNT(*) as count FROM books WHERE category_id = $1",
    [categoryIdValidation.value],
    "Check category has books"
  );

  if (!categoryBooks.success) {
    return res.serverError("Error al verificar libros de la categoría");
  }

  if (parseInt(categoryBooks.data.count) > 0) {
    return res.validationError({
      category: "No se puede eliminar una categoría que tiene libros asociados",
    });
  }

  try {
    const deleteResult = await executeQuerySingle(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [categoryIdValidation.value],
      "Delete category"
    );

    if (!deleteResult.success) {
      logger.error("Error deleting category:", deleteResult.error);
      return res.serverError("Error al eliminar categoría");
    }

    logger.audit(
      "Category deleted successfully",
      {
        category_id: categoryIdValidation.value,
        category_name: existingCategory.data.name,
        deleted_by: req.user.id,
      },
      req
    );

    res.success(null, "Categoría eliminada exitosamente");
  } catch (error) {
    logger.error("Delete category error:", error.message);
    res.serverError("Error al eliminar categoría");
  }
});

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
