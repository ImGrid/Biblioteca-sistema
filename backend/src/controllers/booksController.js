const { BOOKS_QUERIES, AUTHORS_QUERIES } = require("../config/queries");
const {
  executeQuery,
  executeQuerySingle,
  executeQueryPaginated,
  executeTransaction,
} = require("../utils/database");
const {
  validateBookData,
  validatePagination,
  validateId,
} = require("../utils/validation");
const { asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Buscar libros (acceso público para usuarios autenticados)
const searchBooks = asyncHandler(async (req, res) => {
  const { q, category, available_only, page, limit } = req.query;

  // Validar parámetros de paginación
  const pagination = validatePagination(req.query);

  // CORREGIDO: Preparar parámetros con valores por defecto en lugar de null
  const searchTerm = q && q.trim() ? q.trim() : "";
  const categoryId =
    category && !isNaN(parseInt(category)) ? parseInt(category) : 0;
  const onlyAvailable = available_only === "true" ? 1 : 0;

  // CORREGIDO: Query actualizada para manejar valores por defecto
  const searchQuery = `
    SELECT b.id, b.title, b.isbn, b.publisher, b.publication_year,
           b.total_copies, b.available_copies, b.location, b.description,
           c.name as category_name,
           STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ' ORDER BY ba.id) as authors
    FROM books b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN book_authors ba ON b.id = ba.book_id
    LEFT JOIN authors a ON ba.author_id = a.id
    WHERE (
      CASE 
        WHEN $1 = '' THEN TRUE 
        ELSE LOWER(b.title) LIKE LOWER('%' || $1 || '%') 
      END
    )
    AND (
      CASE 
        WHEN $2 = 0 THEN TRUE 
        ELSE b.category_id = $2 
      END
    )
    AND (
      CASE 
        WHEN $3 = 0 THEN TRUE 
        ELSE b.available_copies > 0 
      END
    )
    GROUP BY b.id, b.title, b.isbn, b.publisher, b.publication_year,
             b.total_copies, b.available_copies, b.location, b.description, c.name
    ORDER BY b.title
    LIMIT $4 OFFSET $5
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT b.id) as total 
    FROM books b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE (
      CASE 
        WHEN $1 = '' THEN TRUE 
        ELSE LOWER(b.title) LIKE LOWER('%' || $1 || '%') 
      END
    )
    AND (
      CASE 
        WHEN $2 = 0 THEN TRUE 
        ELSE b.category_id = $2 
      END
    )
    AND (
      CASE 
        WHEN $3 = 0 THEN TRUE 
        ELSE b.available_copies > 0 
      END
    )
  `;

  // Parámetros comunes para ambas queries
  const queryParams = [searchTerm, categoryId, onlyAvailable];

  try {
    const result = await executeQueryPaginated(
      searchQuery,
      countQuery,
      queryParams, // CORREGIDO: Parámetros consistentes
      pagination
    );

    if (!result.success) {
      logger.error("Error searching books:", result.error);
      return res.serverError("Error al buscar libros");
    }

    // Log de búsqueda para estadísticas
    logger.audit(
      "Books search performed",
      {
        search_term: searchTerm || "all",
        category_id: categoryId || "all",
        available_only: onlyAvailable === 1,
        results_count: result.data.length,
        user_id: req.user.id,
        user_role: req.user.role,
      },
      req
    );

    res.fromDatabasePaginated(
      result,
      "Búsqueda de libros realizada exitosamente"
    );
  } catch (error) {
    logger.error("Books search error:", error.message);
    res.serverError("Error al realizar búsqueda");
  }
});

// Obtener libro por ID (acceso público para usuarios autenticados)
const getBookById = asyncHandler(async (req, res) => {
  const bookIdValidation = validateId(req.params.id, "ID del libro");

  if (!bookIdValidation.valid) {
    return res.validationError({ id: bookIdValidation.error });
  }

  try {
    const book = await executeQuerySingle(
      BOOKS_QUERIES.GET_BOOK_BY_ID,
      [bookIdValidation.value],
      "Get book by ID"
    );

    if (!book.success) {
      logger.error("Error getting book by ID:", book.error);
      return res.serverError("Error al obtener libro");
    }

    if (!book.data) {
      return res.notFound("Libro");
    }

    res.success(book.data, "Libro obtenido exitosamente");
  } catch (error) {
    logger.error("Get book by ID error:", error.message);
    res.serverError("Error al obtener libro");
  }
});

// Crear libro (solo admin)
const createBook = asyncHandler(async (req, res) => {
  const validation = validateBookData(req.body);

  if (!validation.valid) {
    return res.validationError(validation.errors, "Datos del libro inválidos");
  }

  const {
    title,
    isbn,
    publisher,
    publication_year,
    category_id,
    total_copies,
    description,
    location,
    author_ids,
  } = validation.data;

  // Validar que los autores existan
  if (!author_ids || !Array.isArray(author_ids) || author_ids.length === 0) {
    return res.validationError({
      author_ids: "Debe especificar al menos un autor",
    });
  }

  // Verificar que el ISBN no exista (si se proporciona)
  if (isbn) {
    const existingBook = await executeQuerySingle(
      "SELECT id FROM books WHERE isbn = $1",
      [isbn],
      "Check ISBN exists"
    );

    if (!existingBook.success) {
      return res.serverError("Error al verificar ISBN");
    }

    if (existingBook.data) {
      return res.conflict("Ya existe un libro con este ISBN");
    }
  }

  // Verificar que la categoría exista
  const categoryExists = await executeQuerySingle(
    "SELECT id FROM categories WHERE id = $1",
    [category_id],
    "Check category exists"
  );

  if (!categoryExists.success || !categoryExists.data) {
    return res.validationError({
      category_id: "La categoría especificada no existe",
    });
  }

  // Verificar que todos los autores existan
  for (const authorId of author_ids) {
    const authorExists = await executeQuerySingle(
      "SELECT id FROM authors WHERE id = $1",
      [authorId],
      "Check author exists"
    );

    if (!authorExists.success || !authorExists.data) {
      return res.validationError({
        author_ids: `El autor con ID ${authorId} no existe`,
      });
    }
  }

  try {
    // Crear libro y relaciones en transacción
    const queries = [
      {
        query: BOOKS_QUERIES.CREATE_BOOK,
        params: [
          title,
          isbn,
          publisher,
          publication_year,
          category_id,
          total_copies,
          location,
          description,
          req.user.id,
        ],
        context: "Create book",
      },
    ];

    const result = await executeTransaction(queries);

    if (!result.success) {
      logger.error("Error creating book:", result.error);
      return res.serverError("Error al crear libro");
    }

    const newBookId = result.results[0].data[0].id;

    // Crear relaciones libro-autor
    for (const authorId of author_ids) {
      await executeQuery(
        "INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)",
        [newBookId, authorId],
        "Create book-author relation"
      );
    }

    // Obtener libro completo creado
    const createdBook = await executeQuerySingle(
      BOOKS_QUERIES.GET_BOOK_BY_ID,
      [newBookId],
      "Get created book"
    );

    logger.audit(
      "Book created successfully",
      {
        book_id: newBookId,
        title: title,
        isbn: isbn,
        created_by: req.user.id,
      },
      req
    );

    res.created(createdBook.data, "Libro creado exitosamente");
  } catch (error) {
    logger.error("Create book error:", error.message);
    res.serverError("Error al crear libro");
  }
});

// Actualizar libro (solo admin)
const updateBook = asyncHandler(async (req, res) => {
  const bookIdValidation = validateId(req.params.id, "ID del libro");

  if (!bookIdValidation.valid) {
    return res.validationError({ id: bookIdValidation.error });
  }

  const validation = validateBookData(req.body);

  if (!validation.valid) {
    return res.validationError(validation.errors, "Datos del libro inválidos");
  }

  const {
    title,
    isbn,
    publisher,
    publication_year,
    category_id,
    total_copies,
    description,
    location,
    author_ids,
  } = validation.data;

  // Verificar que el libro existe
  const existingBook = await executeQuerySingle(
    BOOKS_QUERIES.GET_BOOK_BY_ID,
    [bookIdValidation.value],
    "Check book exists for update"
  );

  if (!existingBook.success || !existingBook.data) {
    return res.notFound("Libro");
  }

  // Verificar ISBN único (excluyendo el libro actual)
  if (isbn && isbn !== existingBook.data.isbn) {
    const isbnExists = await executeQuerySingle(
      "SELECT id FROM books WHERE isbn = $1 AND id != $2",
      [isbn, bookIdValidation.value],
      "Check ISBN unique for update"
    );

    if (!isbnExists.success) {
      return res.serverError("Error al verificar ISBN");
    }

    if (isbnExists.data) {
      return res.conflict("Ya existe otro libro con este ISBN");
    }
  }

  // Verificar que la categoría exista
  const categoryExists = await executeQuerySingle(
    "SELECT id FROM categories WHERE id = $1",
    [category_id],
    "Check category exists for update"
  );

  if (!categoryExists.success || !categoryExists.data) {
    return res.validationError({
      category_id: "La categoría especificada no existe",
    });
  }

  try {
    // Actualizar libro
    const updateResult = await executeQuerySingle(
      BOOKS_QUERIES.UPDATE_BOOK,
      [
        title,
        isbn,
        publisher,
        publication_year,
        category_id,
        total_copies,
        location,
        description,
        bookIdValidation.value,
      ],
      "Update book"
    );

    if (!updateResult.success) {
      logger.error("Error updating book:", updateResult.error);
      return res.serverError("Error al actualizar libro");
    }

    // Actualizar autores si se proporcionaron
    if (author_ids && Array.isArray(author_ids)) {
      // Eliminar relaciones existentes
      await executeQuery(
        "DELETE FROM book_authors WHERE book_id = $1",
        [bookIdValidation.value],
        "Delete existing book-author relations"
      );

      // Crear nuevas relaciones
      for (const authorId of author_ids) {
        const authorExists = await executeQuerySingle(
          "SELECT id FROM authors WHERE id = $1",
          [authorId],
          "Check author exists for book update"
        );

        if (authorExists.success && authorExists.data) {
          await executeQuery(
            "INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)",
            [bookIdValidation.value, authorId],
            "Create new book-author relation"
          );
        }
      }
    }

    // Obtener libro actualizado
    const updatedBook = await executeQuerySingle(
      BOOKS_QUERIES.GET_BOOK_BY_ID,
      [bookIdValidation.value],
      "Get updated book"
    );

    logger.audit(
      "Book updated successfully",
      {
        book_id: bookIdValidation.value,
        title: title,
        updated_by: req.user.id,
      },
      req
    );

    res.success(updatedBook.data, "Libro actualizado exitosamente");
  } catch (error) {
    logger.error("Update book error:", error.message);
    res.serverError("Error al actualizar libro");
  }
});

// Eliminar libro (soft delete - solo admin)
const deleteBook = asyncHandler(async (req, res) => {
  const bookIdValidation = validateId(req.params.id, "ID del libro");

  if (!bookIdValidation.valid) {
    return res.validationError({ id: bookIdValidation.error });
  }

  // Verificar que el libro existe
  const existingBook = await executeQuerySingle(
    BOOKS_QUERIES.GET_BOOK_BY_ID,
    [bookIdValidation.value],
    "Check book exists for delete"
  );

  if (!existingBook.success || !existingBook.data) {
    return res.notFound("Libro");
  }

  // Verificar que no hay préstamos activos
  const activeLoans = await executeQuerySingle(
    "SELECT COUNT(*) as count FROM loans WHERE book_id = $1 AND status = $2",
    [bookIdValidation.value, "active"],
    "Check active loans for book"
  );

  if (!activeLoans.success) {
    return res.serverError("Error al verificar préstamos activos");
  }

  if (parseInt(activeLoans.data.count) > 0) {
    return res.validationError({
      book: "No se puede eliminar un libro con préstamos activos",
    });
  }

  try {
    // Soft delete: marcar como inactivo
    const deleteResult = await executeQuerySingle(
      "UPDATE books SET available_copies = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, title",
      [bookIdValidation.value],
      "Soft delete book"
    );

    if (!deleteResult.success) {
      logger.error("Error deleting book:", deleteResult.error);
      return res.serverError("Error al eliminar libro");
    }

    logger.audit(
      "Book deleted successfully",
      {
        book_id: bookIdValidation.value,
        title: existingBook.data.title,
        deleted_by: req.user.id,
      },
      req
    );

    res.success(null, "Libro eliminado exitosamente");
  } catch (error) {
    logger.error("Delete book error:", error.message);
    res.serverError("Error al eliminar libro");
  }
});

// Listar todos los libros (solo para admin y librarian - gestión)
const getAllBooks = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);

  try {
    const getAllQuery = `
            SELECT b.id, b.title, b.isbn, b.publisher, b.publication_year,
                   b.total_copies, b.available_copies, b.location,
                   c.name as category_name,
                   STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
                   b.created_at, b.updated_at
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            LEFT JOIN book_authors ba ON b.id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.id
            GROUP BY b.id, b.title, b.isbn, b.publisher, b.publication_year,
                     b.total_copies, b.available_copies, b.location, c.name,
                     b.created_at, b.updated_at
            ORDER BY b.created_at DESC
            LIMIT $1 OFFSET $2
        `;

    const countQuery = "SELECT COUNT(*) as total FROM books";

    const result = await executeQueryPaginated(
      getAllQuery,
      countQuery,
      [], // Sin parámetros adicionales para esta query
      pagination
    );

    if (!result.success) {
      logger.error("Error getting all books:", result.error);
      return res.serverError("Error al obtener libros");
    }

    res.fromDatabasePaginated(result, "Lista de libros obtenida exitosamente");
  } catch (error) {
    logger.error("Get all books error:", error.message);
    res.serverError("Error al obtener libros");
  }
});

module.exports = {
  searchBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getAllBooks,
};
