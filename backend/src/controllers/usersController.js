const { USERS_QUERIES } = require("../config/queries");
const {
  executeQuery,
  executeQuerySingle,
  executeQueryPaginated,
} = require("../utils/database");
const {
  validatePagination,
  validateId,
  validateString,
  validateEmail,
} = require("../utils/validation");
const { hashPassword, sanitizeUserForResponse } = require("../utils/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Buscar usuarios (solo staff) - para formularios de préstamos
const searchUsers = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  const pagination = validatePagination({ page, limit });

  try {
    let searchQuery,
      countQuery,
      params = [];

    if (q && q.trim()) {
      // Búsqueda por nombre o email
      const searchTerm = q.trim();
      searchQuery = `
        SELECT id, email, first_name, last_name, phone, role, is_active, created_at, last_login
        FROM users 
        WHERE role = 'user' 
        AND is_active = true
        AND (
          LOWER(first_name || ' ' || last_name) LIKE LOWER('%' || $1 || '%') OR
          LOWER(email) LIKE LOWER('%' || $1 || '%')
        )
        ORDER BY last_name, first_name
        LIMIT $2 OFFSET $3
      `;
      countQuery = `
        SELECT COUNT(*) as total FROM users 
        WHERE role = 'user' 
        AND is_active = true
        AND (
          LOWER(first_name || ' ' || last_name) LIKE LOWER('%' || $1 || '%') OR
          LOWER(email) LIKE LOWER('%' || $1 || '%')
        )
      `;
      params = [searchTerm];
    } else {
      // Listar usuarios recientes
      searchQuery = `
        SELECT id, email, first_name, last_name, phone, role, is_active, created_at, last_login
        FROM users 
        WHERE role = 'user' AND is_active = true
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `
        SELECT COUNT(*) as total FROM users WHERE role = 'user' AND is_active = true
      `;
    }

    const result = await executeQueryPaginated(
      searchQuery,
      countQuery,
      params,
      pagination
    );

    if (!result.success) {
      logger.error("Error searching users:", result.error);
      return res.serverError("Error al buscar usuarios");
    }

    logger.audit(
      "Users search performed",
      {
        search_term: q || "all",
        results_count: result.data.length,
        user_id: req.user.id,
        user_role: req.user.role,
      },
      req
    );

    res.fromDatabasePaginated(
      result,
      "Búsqueda de usuarios realizada exitosamente"
    );
  } catch (error) {
    logger.error("Search users error:", error.message);
    res.serverError("Error al realizar búsqueda de usuarios");
  }
});

// Obtener usuario por ID con estadísticas (solo staff)
const getUserById = asyncHandler(async (req, res) => {
  const userIdValidation = validateId(req.params.id, "ID del usuario");

  if (!userIdValidation.valid) {
    return res.validationError({ id: userIdValidation.error });
  }

  try {
    // Obtener información del usuario con estadísticas
    const user = await executeQuerySingle(
      USERS_QUERIES.GET_USER_STATS,
      [userIdValidation.value],
      "Get user with stats"
    );

    if (!user.success) {
      logger.error("Error getting user by ID:", user.error);
      return res.serverError("Error al obtener usuario");
    }

    if (!user.data) {
      return res.notFound("Usuario");
    }

    // Sanitizar datos del usuario
    const userData = sanitizeUserForResponse(user.data);

    res.success(userData, "Usuario obtenido exitosamente");
  } catch (error) {
    logger.error("Get user by ID error:", error.message);
    res.serverError("Error al obtener usuario");
  }
});

// Listar todos los usuarios con paginación (solo admin)
const getAllUsers = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);
  const { role, active_only } = req.query;

  try {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    // Filtrar por rol si se especifica
    if (role && ["admin", "librarian", "user"].includes(role)) {
      paramCount++;
      whereConditions.push(`role = $${paramCount}`);
      params.push(role);
    } else {
      // Por defecto, no mostrar otros admins
      whereConditions.push("role != 'admin' OR id = " + req.user.id);
    }

    // Filtrar solo usuarios activos si se especifica
    if (active_only === "true") {
      whereConditions.push("is_active = true");
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const getUsersQuery = `
      SELECT id, email, first_name, last_name, phone, role, is_active, 
             created_at, last_login, max_loans
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM users ${whereClause}
    `;

    const result = await executeQueryPaginated(
      getUsersQuery,
      countQuery,
      params,
      pagination
    );

    if (!result.success) {
      logger.error("Error getting all users:", result.error);
      return res.serverError("Error al obtener usuarios");
    }

    // Sanitizar datos de todos los usuarios
    const sanitizedUsers = result.data.map((user) =>
      sanitizeUserForResponse(user)
    );

    res.fromDatabasePaginated(
      {
        ...result,
        data: sanitizedUsers,
      },
      "Lista de usuarios obtenida exitosamente"
    );
  } catch (error) {
    logger.error("Get all users error:", error.message);
    res.serverError("Error al obtener usuarios");
  }
});

// Crear usuario (solo admin)
const createUser = asyncHandler(async (req, res) => {
  const { validateUserRegistration } = require("../utils/validation");

  // Usar la misma validación que el registro pero permitir especificar rol
  const validation = validateUserRegistration(req.body);

  if (!validation.valid) {
    return res.validationError(
      validation.errors,
      "Datos del usuario inválidos"
    );
  }

  const {
    email,
    password,
    first_name,
    last_name,
    phone,
    address,
    role = "user",
  } = validation.data;

  // Validar rol
  if (!["admin", "librarian", "user"].includes(role)) {
    return res.validationError({ role: "Rol inválido" });
  }

  // Verificar que el email no existe
  const emailExists = await executeQuerySingle(
    USERS_QUERIES.CHECK_EMAIL_EXISTS,
    [email],
    "Check email exists for user creation"
  );

  if (!emailExists.success) {
    logger.error("Database error during email check:", emailExists.error);
    return res.serverError("Error al verificar email");
  }

  if (emailExists.data) {
    return res.conflict("El email ya está registrado");
  }

  try {
    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);

    // Crear usuario
    const newUser = await executeQuerySingle(
      USERS_QUERIES.CREATE_USER,
      [email, hashedPassword, first_name, last_name, phone, address, role],
      "Create new user by admin"
    );

    if (!newUser.success) {
      if (newUser.code === "23505") {
        return res.conflict("El usuario ya existe");
      }

      logger.error("Database error during user creation:", newUser.error);
      return res.serverError("Error al crear usuario");
    }

    const userData = sanitizeUserForResponse(newUser.data);

    logger.audit(
      "User created by admin",
      {
        new_user_id: userData.id,
        email: userData.email,
        role: userData.role,
        created_by: req.user.id,
      },
      req
    );

    res.created(userData, "Usuario creado exitosamente");
  } catch (error) {
    logger.error("Create user error:", error.message);
    res.serverError("Error al crear usuario");
  }
});

// Actualizar usuario (solo admin)
const updateUser = asyncHandler(async (req, res) => {
  const userIdValidation = validateId(req.params.id, "ID del usuario");

  if (!userIdValidation.valid) {
    return res.validationError({ id: userIdValidation.error });
  }

  const { first_name, last_name, phone, address, role, is_active, max_loans } =
    req.body;

  // Validaciones básicas
  const errors = {};

  if (
    first_name &&
    typeof first_name === "string" &&
    first_name.trim().length < 2
  ) {
    errors.first_name = "Nombre debe tener al menos 2 caracteres";
  }

  if (
    last_name &&
    typeof last_name === "string" &&
    last_name.trim().length < 2
  ) {
    errors.last_name = "Apellido debe tener al menos 2 caracteres";
  }

  if (role && !["admin", "librarian", "user"].includes(role)) {
    errors.role = "Rol inválido";
  }

  if (max_loans && (isNaN(max_loans) || max_loans < 1 || max_loans > 10)) {
    errors.max_loans = "Máximo de préstamos debe estar entre 1 y 10";
  }

  if (Object.keys(errors).length > 0) {
    return res.validationError(errors, "Datos del usuario inválidos");
  }

  try {
    // Verificar que el usuario existe
    const existingUser = await executeQuerySingle(
      USERS_QUERIES.GET_USER_PROFILE,
      [userIdValidation.value],
      "Check user exists for update"
    );

    if (!existingUser.success || !existingUser.data) {
      return res.notFound("Usuario");
    }

    // Construir query de actualización dinámicamente
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (first_name) {
      paramCount++;
      updateFields.push(`first_name = $${paramCount}`);
      updateValues.push(first_name.trim());
    }

    if (last_name) {
      paramCount++;
      updateFields.push(`last_name = $${paramCount}`);
      updateValues.push(last_name.trim());
    }

    if (phone !== undefined) {
      paramCount++;
      updateFields.push(`phone = $${paramCount}`);
      updateValues.push(phone);
    }

    if (address !== undefined) {
      paramCount++;
      updateFields.push(`address = $${paramCount}`);
      updateValues.push(address);
    }

    if (role) {
      paramCount++;
      updateFields.push(`role = $${paramCount}`);
      updateValues.push(role);
    }

    if (is_active !== undefined) {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      updateValues.push(is_active);
    }

    if (max_loans) {
      paramCount++;
      updateFields.push(`max_loans = $${paramCount}`);
      updateValues.push(parseInt(max_loans));
    }

    if (updateFields.length === 0) {
      return res.validationError({ update: "No hay campos para actualizar" });
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateValues.push(userIdValidation.value);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(", ")}
      WHERE id = $${updateValues.length}
      RETURNING id, email, first_name, last_name, phone, address, role, is_active, max_loans, updated_at
    `;

    const updatedUser = await executeQuerySingle(
      updateQuery,
      updateValues,
      "Update user"
    );

    if (!updatedUser.success) {
      logger.error("Error updating user:", updatedUser.error);
      return res.serverError("Error al actualizar usuario");
    }

    const userData = sanitizeUserForResponse(updatedUser.data);

    logger.audit(
      "User updated by admin",
      {
        updated_user_id: userIdValidation.value,
        updated_fields: updateFields.filter((f) => !f.includes("updated_at")),
        updated_by: req.user.id,
      },
      req
    );

    res.success(userData, "Usuario actualizado exitosamente");
  } catch (error) {
    logger.error("Update user error:", error.message);
    res.serverError("Error al actualizar usuario");
  }
});

// Activar/Desactivar usuario (solo admin)
const toggleUserStatus = asyncHandler(async (req, res) => {
  const userIdValidation = validateId(req.params.id, "ID del usuario");

  if (!userIdValidation.valid) {
    return res.validationError({ id: userIdValidation.error });
  }

  try {
    // Obtener estado actual del usuario
    const currentUser = await executeQuerySingle(
      "SELECT id, email, first_name, last_name, is_active FROM users WHERE id = $1",
      [userIdValidation.value],
      "Get user current status"
    );

    if (!currentUser.success || !currentUser.data) {
      return res.notFound("Usuario");
    }

    // No permitir desactivar a sí mismo
    if (userIdValidation.value === req.user.id) {
      return res.validationError({
        user: "No puedes desactivar tu propia cuenta",
      });
    }

    // Alternar estado
    const newStatus = !currentUser.data.is_active;

    const updateResult = await executeQuerySingle(
      "UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, is_active",
      [newStatus, userIdValidation.value],
      "Toggle user status"
    );

    if (!updateResult.success) {
      logger.error("Error toggling user status:", updateResult.error);
      return res.serverError("Error al cambiar estado del usuario");
    }

    logger.audit(
      `User ${newStatus ? "activated" : "deactivated"}`,
      {
        target_user_id: userIdValidation.value,
        target_user_email: currentUser.data.email,
        new_status: newStatus,
        changed_by: req.user.id,
      },
      req
    );

    res.success(
      {
        id: userIdValidation.value,
        is_active: newStatus,
      },
      `Usuario ${newStatus ? "activado" : "desactivado"} exitosamente`
    );
  } catch (error) {
    logger.error("Toggle user status error:", error.message);
    res.serverError("Error al cambiar estado del usuario");
  }
});

// Obtener estadísticas detalladas de usuario (solo staff)
const getUserStats = asyncHandler(async (req, res) => {
  const userIdValidation = validateId(req.params.id, "ID del usuario");

  if (!userIdValidation.valid) {
    return res.validationError({ id: userIdValidation.error });
  }

  try {
    // Estadísticas completas del usuario
    const userStats = await executeQuerySingle(
      USERS_QUERIES.GET_USER_STATS,
      [userIdValidation.value],
      "Get detailed user statistics"
    );

    if (!userStats.success) {
      logger.error("Error getting user stats:", userStats.error);
      return res.serverError("Error al obtener estadísticas del usuario");
    }

    if (!userStats.data) {
      return res.notFound("Usuario");
    }

    // Obtener historial de préstamos reciente (últimos 10)
    const recentLoans = await executeQuery(
      `SELECT l.id, l.loan_date, l.due_date, l.return_date, l.status,
              b.title, b.isbn,
              STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
       FROM loans l
       JOIN books b ON l.book_id = b.id
       LEFT JOIN book_authors ba ON b.id = ba.book_id
       LEFT JOIN authors a ON ba.author_id = a.id
       WHERE l.user_id = $1
       GROUP BY l.id, l.loan_date, l.due_date, l.return_date, l.status, b.title, b.isbn
       ORDER BY l.loan_date DESC
       LIMIT 10`,
      [userIdValidation.value],
      "Get user recent loans"
    );

    // Obtener multas pendientes
    const pendingFines = await executeQuery(
      `SELECT f.id, f.amount, f.reason, f.created_at,
              l.due_date, b.title
       FROM fines f
       JOIN loans l ON f.loan_id = l.id
       JOIN books b ON l.book_id = b.id
       WHERE f.user_id = $1 AND f.is_paid = false
       ORDER BY f.created_at DESC`,
      [userIdValidation.value],
      "Get user pending fines"
    );

    const statsData = {
      user: sanitizeUserForResponse(userStats.data),
      recent_loans: recentLoans.success ? recentLoans.data : [],
      pending_fines: pendingFines.success ? pendingFines.data : [],
    };

    res.success(statsData, "Estadísticas del usuario obtenidas exitosamente");
  } catch (error) {
    logger.error("Get user stats error:", error.message);
    res.serverError("Error al obtener estadísticas del usuario");
  }
});

module.exports = {
  searchUsers,
  getUserById,
  getAllUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getUserStats,
};
