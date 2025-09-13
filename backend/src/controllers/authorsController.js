const { AUTHORS_QUERIES } = require("../config/queries");
const {
  executeQuery,
  executeQuerySingle,
  executeQueryPaginated,
} = require("../utils/database");
const {
  validateString,
  validatePagination,
  validateId,
} = require("../utils/validation");
const { asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Validación específica para datos de autor
const validateAuthorData = (data) => {
  const errors = {};
  const validatedData = {};

  // First name
  const firstNameValidation = validateString(data.first_name, "Nombre", {
    minLength: 2,
    maxLength: 100,
  });
  if (!firstNameValidation.valid) {
    errors.first_name = firstNameValidation.error;
  } else {
    validatedData.first_name = firstNameValidation.value;
  }

  // Last name
  const lastNameValidation = validateString(data.last_name, "Apellido", {
    minLength: 2,
    maxLength: 100,
  });
  if (!lastNameValidation.valid) {
    errors.last_name = lastNameValidation.error;
  } else {
    validatedData.last_name = lastNameValidation.value;
  }

  // Bio (opcional)
  if (data.bio !== undefined) {
    const bioValidation = validateString(data.bio, "Biografía", {
      required: false,
      maxLength: 1000,
    });
    if (!bioValidation.valid) {
      errors.bio = bioValidation.error;
    } else {
      validatedData.bio = bioValidation.value;
    }
  }

  // Birth date (opcional)
  if (
    data.birth_date !== undefined &&
    data.birth_date !== null &&
    data.birth_date !== ""
  ) {
    const birthDate = new Date(data.birth_date);
    if (isNaN(birthDate.getTime())) {
      errors.birth_date = "Fecha de nacimiento inválida";
    } else {
      // Verificar que no sea una fecha futura
      if (birthDate > new Date()) {
        errors.birth_date = "La fecha de nacimiento no puede ser futura";
      } else {
        validatedData.birth_date = data.birth_date;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Listar autores (acceso público para usuarios autenticados)
const getAuthors = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);
  const { search } = req.query;

  try {
    let query, countQuery, params;

    if (search && search.trim()) {
      // Búsqueda por nombre
      query = `
                SELECT id, first_name, last_name, bio, birth_date, created_at
                FROM authors 
                WHERE LOWER(first_name || ' ' || last_name) LIKE LOWER('%' || $1 || '%')
                ORDER BY last_name, first_name
                LIMIT $2 OFFSET $3
            `;
      countQuery = `
                SELECT COUNT(*) as total FROM authors 
                WHERE LOWER(first_name || ' ' || last_name) LIKE LOWER('%' || $1 || '%')
            `;
      params = [search.trim()];
    } else {
      // Lista completa
      query = AUTHORS_QUERIES.LIST_AUTHORS;
      countQuery = "SELECT COUNT(*) as total FROM authors";
      params = [];
    }

    const result = await executeQueryPaginated(
      query,
      countQuery,
      params,
      pagination
    );

    if (!result.success) {
      logger.error("Error getting authors:", result.error);
      return res.serverError("Error al obtener autores");
    }

    res.fromDatabasePaginated(result, "Lista de autores obtenida exitosamente");
  } catch (error) {
    logger.error("Get authors error:", error.message);
    res.serverError("Error al obtener autores");
  }
});

// Obtener autor por ID (acceso público para usuarios autenticados)
const getAuthorById = asyncHandler(async (req, res) => {
  const authorIdValidation = validateId(req.params.id, "ID del autor");

  if (!authorIdValidation.valid) {
    return res.validationError({ id: authorIdValidation.error });
  }

  try {
    const author = await executeQuerySingle(
      "SELECT id, first_name, last_name, bio, birth_date, created_at FROM authors WHERE id = $1",
      [authorIdValidation.value],
      "Get author by ID"
    );

    if (!author.success) {
      logger.error("Error getting author by ID:", author.error);
      return res.serverError("Error al obtener autor");
    }

    if (!author.data) {
      return res.notFound("Autor");
    }

    // Obtener libros del autor
    const booksQuery = `
            SELECT b.id, b.title, b.isbn, b.publication_year, b.available_copies > 0 as available
            FROM books b
            JOIN book_authors ba ON b.id = ba.book_id
            WHERE ba.author_id = $1
            ORDER BY b.publication_year DESC
        `;

    const books = await executeQuery(
      booksQuery,
      [authorIdValidation.value],
      "Get books by author"
    );

    const authorData = {
      ...author.data,
      books: books.success ? books.data : [],
    };

    res.success(authorData, "Autor obtenido exitosamente");
  } catch (error) {
    logger.error("Get author by ID error:", error.message);
    res.serverError("Error al obtener autor");
  }
});

// Crear autor (solo admin)
const createAuthor = asyncHandler(async (req, res) => {
  const validation = validateAuthorData(req.body);

  if (!validation.valid) {
    return res.validationError(validation.errors, "Datos del autor inválidos");
  }

  const { first_name, last_name, bio, birth_date } = validation.data;

  // Verificar que no exista un autor con el mismo nombre
  const existingAuthor = await executeQuerySingle(
    AUTHORS_QUERIES.CHECK_AUTHOR_EXISTS,
    [first_name, last_name],
    "Check author exists"
  );

  if (!existingAuthor.success) {
    return res.serverError("Error al verificar autor existente");
  }

  if (existingAuthor.data) {
    return res.conflict("Ya existe un autor con este nombre");
  }

  try {
    const newAuthor = await executeQuerySingle(
      AUTHORS_QUERIES.CREATE_AUTHOR,
      [first_name, last_name, bio, birth_date],
      "Create author"
    );

    if (!newAuthor.success) {
      logger.error("Error creating author:", newAuthor.error);
      return res.serverError("Error al crear autor");
    }

    logger.audit(
      "Author created successfully",
      {
        author_id: newAuthor.data.id,
        author_name: `${first_name} ${last_name}`,
        created_by: req.user.id,
      },
      req
    );

    res.created(newAuthor.data, "Autor creado exitosamente");
  } catch (error) {
    logger.error("Create author error:", error.message);
    res.serverError("Error al crear autor");
  }
});

// Actualizar autor (solo admin)
const updateAuthor = asyncHandler(async (req, res) => {
  const authorIdValidation = validateId(req.params.id, "ID del autor");

  if (!authorIdValidation.valid) {
    return res.validationError({ id: authorIdValidation.error });
  }

  const validation = validateAuthorData(req.body);

  if (!validation.valid) {
    return res.validationError(validation.errors, "Datos del autor inválidos");
  }

  const { first_name, last_name, bio, birth_date } = validation.data;

  // Verificar que el autor existe
  const existingAuthor = await executeQuerySingle(
    "SELECT id, first_name, last_name FROM authors WHERE id = $1",
    [authorIdValidation.value],
    "Check author exists for update"
  );

  if (!existingAuthor.success || !existingAuthor.data) {
    return res.notFound("Autor");
  }

  // Verificar nombre único (excluyendo el autor actual)
  const nameExists = await executeQuerySingle(
    "SELECT id FROM authors WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2) AND id != $3",
    [first_name, last_name, authorIdValidation.value],
    "Check author name unique for update"
  );

  if (!nameExists.success) {
    return res.serverError("Error al verificar nombre del autor");
  }

  if (nameExists.data) {
    return res.conflict("Ya existe otro autor con este nombre");
  }

  try {
    const updateQuery = `
            UPDATE authors 
            SET first_name = $1, last_name = $2, bio = $3, birth_date = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING id, first_name, last_name, bio, birth_date, updated_at
        `;

    const updatedAuthor = await executeQuerySingle(
      updateQuery,
      [first_name, last_name, bio, birth_date, authorIdValidation.value],
      "Update author"
    );

    if (!updatedAuthor.success) {
      logger.error("Error updating author:", updatedAuthor.error);
      return res.serverError("Error al actualizar autor");
    }

    logger.audit(
      "Author updated successfully",
      {
        author_id: authorIdValidation.value,
        author_name: `${first_name} ${last_name}`,
        updated_by: req.user.id,
      },
      req
    );

    res.success(updatedAuthor.data, "Autor actualizado exitosamente");
  } catch (error) {
    logger.error("Update author error:", error.message);
    res.serverError("Error al actualizar autor");
  }
});

// Eliminar autor (solo admin)
const deleteAuthor = asyncHandler(async (req, res) => {
  const authorIdValidation = validateId(req.params.id, "ID del autor");

  if (!authorIdValidation.valid) {
    return res.validationError({ id: authorIdValidation.error });
  }

  // Verificar que el autor existe
  const existingAuthor = await executeQuerySingle(
    "SELECT id, first_name, last_name FROM authors WHERE id = $1",
    [authorIdValidation.value],
    "Check author exists for delete"
  );

  if (!existingAuthor.success || !existingAuthor.data) {
    return res.notFound("Autor");
  }

  // Verificar que no tiene libros asociados
  const authorBooks = await executeQuerySingle(
    "SELECT COUNT(*) as count FROM book_authors WHERE author_id = $1",
    [authorIdValidation.value],
    "Check author has books"
  );

  if (!authorBooks.success) {
    return res.serverError("Error al verificar libros del autor");
  }

  if (parseInt(authorBooks.data.count) > 0) {
    return res.validationError({
      author: "No se puede eliminar un autor que tiene libros asociados",
    });
  }

  try {
    const deleteResult = await executeQuerySingle(
      "DELETE FROM authors WHERE id = $1 RETURNING id",
      [authorIdValidation.value],
      "Delete author"
    );

    if (!deleteResult.success) {
      logger.error("Error deleting author:", deleteResult.error);
      return res.serverError("Error al eliminar autor");
    }

    logger.audit(
      "Author deleted successfully",
      {
        author_id: authorIdValidation.value,
        author_name: `${existingAuthor.data.first_name} ${existingAuthor.data.last_name}`,
        deleted_by: req.user.id,
      },
      req
    );

    res.success(null, "Autor eliminado exitosamente");
  } catch (error) {
    logger.error("Delete author error:", error.message);
    res.serverError("Error al eliminar autor");
  }
});

module.exports = {
  getAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
};
