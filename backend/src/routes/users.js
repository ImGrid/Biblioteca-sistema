const express = require("express");
const router = express.Router();

const usersController = require("../controllers/usersController");
const { authenticate } = require("../middleware/auth");
const {
  requireAdmin,
  requireStaff,
  requireUser,
} = require("../middleware/roleAuth");
const {
  searchRateLimit,
  createResourceRateLimit,
} = require("../middleware/rateLimiter");
const {
  validateRequest,
  validateParams,
} = require("../middleware/errorHandler");
const { validateId } = require("../utils/validation");

// Validación de parámetros de ID
const validateUserId = {
  id: (value) => validateId(value, "ID del usuario"),
};

// Validación de datos de usuario
const validateUserData = (data) => {
  const { validateString, validateEmail } = require("../utils/validation");
  const errors = {};
  const validatedData = {};

  // Email (requerido para crear)
  if (data.email) {
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
      errors.email = emailValidation.error;
    } else {
      validatedData.email = emailValidation.value;
    }
  }

  // Password (requerido para crear)
  if (data.password) {
    if (typeof data.password !== "string" || data.password.length < 6) {
      errors.password = "Contraseña debe tener al menos 6 caracteres";
    } else {
      validatedData.password = data.password;
    }
  }

  // First name
  if (data.first_name !== undefined) {
    const firstNameValidation = validateString(data.first_name, "Nombre", {
      required: true,
      minLength: 2,
      maxLength: 100,
    });
    if (!firstNameValidation.valid) {
      errors.first_name = firstNameValidation.error;
    } else {
      validatedData.first_name = firstNameValidation.value;
    }
  }

  // Last name
  if (data.last_name !== undefined) {
    const lastNameValidation = validateString(data.last_name, "Apellido", {
      required: true,
      minLength: 2,
      maxLength: 100,
    });
    if (!lastNameValidation.valid) {
      errors.last_name = lastNameValidation.error;
    } else {
      validatedData.last_name = lastNameValidation.value;
    }
  }

  // Phone (opcional)
  if (data.phone !== undefined) {
    const phoneValidation = validateString(data.phone, "Teléfono", {
      required: false,
      maxLength: 20,
    });
    if (!phoneValidation.valid) {
      errors.phone = phoneValidation.error;
    } else {
      validatedData.phone = phoneValidation.value;
    }
  }

  // Address (opcional)
  if (data.address !== undefined) {
    const addressValidation = validateString(data.address, "Dirección", {
      required: false,
      maxLength: 500,
    });
    if (!addressValidation.valid) {
      errors.address = addressValidation.error;
    } else {
      validatedData.address = addressValidation.value;
    }
  }

  // Role (opcional, default 'user')
  if (data.role !== undefined) {
    const validRoles = ["admin", "librarian", "user"];
    if (!validRoles.includes(data.role)) {
      errors.role = `Rol debe ser: ${validRoles.join(", ")}`;
    } else {
      validatedData.role = data.role;
    }
  }

  // Is active (opcional para updates)
  if (data.is_active !== undefined) {
    if (typeof data.is_active !== "boolean") {
      errors.is_active = "Estado activo debe ser verdadero o falso";
    } else {
      validatedData.is_active = data.is_active;
    }
  }

  // Max loans (opcional)
  if (data.max_loans !== undefined) {
    const maxLoans = parseInt(data.max_loans);
    if (isNaN(maxLoans) || maxLoans < 1 || maxLoans > 10) {
      errors.max_loans = "Máximo de préstamos debe estar entre 1 y 10";
    } else {
      validatedData.max_loans = maxLoans;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireUser);

// RUTAS PARA BÚSQUEDA Y CONSULTA (Staff: bibliotecarios y admin)

// GET /api/users/search - Buscar usuarios (para formularios de préstamos)
router.get(
  "/search",
  requireStaff, // Solo bibliotecarios y admin
  searchRateLimit,
  usersController.searchUsers
);

// GET /api/users/:id - Obtener usuario por ID con estadísticas básicas
router.get(
  "/:id",
  requireStaff, // Solo bibliotecarios y admin
  validateParams(validateUserId),
  usersController.getUserById
);

// GET /api/users/:id/stats - Obtener estadísticas detalladas de usuario
router.get(
  "/:id/stats",
  requireStaff, // Solo bibliotecarios y admin
  validateParams(validateUserId),
  usersController.getUserStats
);

// RUTAS DE GESTIÓN ADMINISTRATIVA (Solo admin)

// GET /api/users - Listar todos los usuarios con paginación
router.get(
  "/",
  requireAdmin, // Solo administradores
  usersController.getAllUsers
);

// POST /api/users - Crear nuevo usuario
router.post(
  "/",
  requireAdmin, // Solo administradores
  createResourceRateLimit,
  validateRequest(validateUserData),
  usersController.createUser
);

// PUT /api/users/:id - Actualizar usuario
router.put(
  "/:id",
  requireAdmin, // Solo administradores
  validateParams(validateUserId),
  validateRequest(validateUserData),
  usersController.updateUser
);

// PUT /api/users/:id/toggle-status - Activar/Desactivar usuario
router.put(
  "/:id/toggle-status",
  requireAdmin, // Solo administradores
  validateParams(validateUserId),
  usersController.toggleUserStatus
);

// Middleware de manejo de errores específico para usuarios
router.use((error, req, res, next) => {
  const logger = require("../utils/logger");

  // Log errores específicos de gestión de usuarios
  if (error.statusCode >= 400) {
    logger.security(
      "Users route error",
      {
        error: error.message,
        statusCode: error.statusCode,
        url: req.originalUrl,
        method: req.method,
        user_id: req.user?.id,
        user_role: req.user?.role,
        target_user: req.params?.id,
      },
      req
    );
  }

  next(error);
});

module.exports = router;
