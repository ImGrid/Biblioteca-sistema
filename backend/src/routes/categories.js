const express = require("express");
const router = express.Router();

const categoriesController = require("../controllers/categoriesController");
const { authenticate } = require("../middleware/auth");
const { requireAdmin, requireUser } = require("../middleware/roleAuth");
const { createResourceRateLimit } = require("../middleware/rateLimiter");
const {
  validateRequest,
  validateParams,
} = require("../middleware/errorHandler");
const { validateId } = require("../utils/validation");

// Validación de parámetros de ID
const validateCategoryId = {
  id: (value) => validateId(value, "ID de la categoría"),
};

// Validación de datos de categoría
const validateCategoryData = (data) => {
  const { validateString } = require("../utils/validation");
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

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireUser);

// Rutas públicas para usuarios autenticados (GET - solo lectura)

// GET /api/categories - Listar categorías
router.get("/", categoriesController.getCategories);

// GET /api/categories/:id - Obtener categoría por ID
router.get(
  "/:id",
  validateParams(validateCategoryId),
  categoriesController.getCategoryById
);

// Rutas de modificación (solo admin)

// POST /api/categories - Crear categoría
router.post(
  "/",
  requireAdmin,
  createResourceRateLimit,
  validateRequest(validateCategoryData),
  categoriesController.createCategory
);

// PUT /api/categories/:id - Actualizar categoría
router.put(
  "/:id",
  requireAdmin,
  validateParams(validateCategoryId),
  validateRequest(validateCategoryData),
  categoriesController.updateCategory
);

// DELETE /api/categories/:id - Eliminar categoría
router.delete(
  "/:id",
  requireAdmin,
  validateParams(validateCategoryId),
  categoriesController.deleteCategory
);

// Middleware de manejo de errores específico para categorías
router.use((error, req, res, next) => {
  const logger = require("../utils/logger");

  if (error.statusCode >= 400) {
    logger.security(
      "Categories route error",
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
