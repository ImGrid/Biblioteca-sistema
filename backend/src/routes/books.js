const express = require("express");
const router = express.Router();

const booksController = require("../controllers/booksController");
const { authenticate } = require("../middleware/auth");
const {
  requireAdmin,
  requireUser,
  requireStaff,
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
const validateBookId = {
  id: (value) => validateId(value, "ID del libro"),
};

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireUser);

// Rutas públicas para usuarios autenticados (GET - solo lectura)

// GET /api/books/search - Buscar libros
router.get("/search", searchRateLimit, booksController.searchBooks);

// GET /api/books/:id - Obtener libro por ID
router.get("/:id", validateParams(validateBookId), booksController.getBookById);

// Rutas administrativas (solo admin y librarian pueden ver lista completa)

// GET /api/books - Listar todos los libros (para gestión)
router.get(
  "/",
  requireStaff, // Solo admin y librarian
  booksController.getAllBooks
);

// Rutas de modificación (solo admin)

// POST /api/books - Crear libro
router.post(
  "/",
  requireAdmin,
  createResourceRateLimit,
  validateRequest((data) => {
    const { validateBookData } = require("../utils/validation");
    return validateBookData(data);
  }),
  booksController.createBook
);

// PUT /api/books/:id - Actualizar libro
router.put(
  "/:id",
  requireAdmin,
  validateParams(validateBookId),
  validateRequest((data) => {
    const { validateBookData } = require("../utils/validation");
    return validateBookData(data);
  }),
  booksController.updateBook
);

// DELETE /api/books/:id - Eliminar libro
router.delete(
  "/:id",
  requireAdmin,
  validateParams(validateBookId),
  booksController.deleteBook
);

// Middleware de manejo de errores específico para libros
router.use((error, req, res, next) => {
  const logger = require("../utils/logger");

  // Log errores específicos de libros
  if (error.statusCode >= 400) {
    logger.security(
      "Books route error",
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
