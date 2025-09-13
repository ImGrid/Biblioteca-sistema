const express = require("express");
const router = express.Router();

const authorsController = require("../controllers/authorsController");
const { authenticate } = require("../middleware/auth");
const { requireAdmin, requireUser } = require("../middleware/roleAuth");
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
const validateAuthorId = {
  id: (value) => validateId(value, "ID del autor"),
};

// Validación de datos de autor
const validateAuthorData = (data) => {
  const { validateString } = require("../utils/validation");
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

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireUser);

// Rutas públicas para usuarios autenticados (GET - solo lectura)

// GET /api/authors - Listar autores
router.get("/", searchRateLimit, authorsController.getAuthors);

// GET /api/authors/:id - Obtener autor por ID
router.get(
  "/:id",
  validateParams(validateAuthorId),
  authorsController.getAuthorById
);

// Rutas de modificación (solo admin)

// POST /api/authors - Crear autor
router.post(
  "/",
  requireAdmin,
  createResourceRateLimit,
  validateRequest(validateAuthorData),
  authorsController.createAuthor
);

// PUT /api/authors/:id - Actualizar autor
router.put(
  "/:id",
  requireAdmin,
  validateParams(validateAuthorId),
  validateRequest(validateAuthorData),
  authorsController.updateAuthor
);

// DELETE /api/authors/:id - Eliminar autor
router.delete(
  "/:id",
  requireAdmin,
  validateParams(validateAuthorId),
  authorsController.deleteAuthor
);

// Middleware de manejo de errores específico para autores
router.use((error, req, res, next) => {
  const logger = require("../utils/logger");

  if (error.statusCode >= 400) {
    logger.security(
      "Authors route error",
      {
        error: error.message,
        statusCode: error.statusCode,
        url: req.originalUrl,
        method: req.method,
        user_id: req.user?.id,
        user_role: req.user?.role,
      },
      req
    );
  }

  next(error);
});

module.exports = router;
