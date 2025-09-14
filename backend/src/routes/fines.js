const express = require("express");
const router = express.Router();

const finesController = require("../controllers/finesController");
const { authenticate } = require("../middleware/auth");
const {
  requireAdmin,
  requireStaff,
  requireUser,
} = require("../middleware/roleAuth");
const {
  reportsRateLimit,
  createResourceRateLimit,
  searchRateLimit,
} = require("../middleware/rateLimiter");
const { validateRequest } = require("../middleware/errorHandler");

// Importar middleware específico de validación de pagos
const {
  validatePaymentData,
  validateForgiveData,
  requirePaymentPermissions,
  logPaymentOperation,
} = require("../middleware/paymentValidation");

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireUser);

// RUTAS PARA BIBLIOTECARIOS Y ADMIN (Gestión de multas)

// GET /api/fines/pending - Multas pendientes
router.get(
  "/pending",
  requireStaff, // Solo bibliotecarios y admin
  requirePaymentPermissions("view_all_fines"),
  searchRateLimit,
  finesController.getPendingFines
);

// POST /api/fines/generate-overdue - Generar multas por retrasos (job manual)
router.post(
  "/generate-overdue",
  requireAdmin, // Solo administradores
  requirePaymentPermissions("generate_fines"),
  createResourceRateLimit,
  logPaymentOperation("generate_overdue_fines"),
  finesController.generateOverdueFines
);

// PUT /api/fines/:id/pay - Procesar pago de multa
router.put(
  "/:id/pay",
  requireStaff, // Solo bibliotecarios y admin
  requirePaymentPermissions("process_payments"),
  createResourceRateLimit,
  validateRequest(validatePaymentData),
  logPaymentOperation("process_payment"),
  finesController.processPayment
);

// PUT /api/fines/:id/forgive - Condonar multa (solo admin)
router.put(
  "/:id/forgive",
  requireAdmin, // Solo administradores
  requirePaymentPermissions("forgive_fines"),
  createResourceRateLimit,
  validateRequest(validateForgiveData),
  logPaymentOperation("forgive_fine"),
  finesController.forgiveFine
);

// GET /api/fines/user/:user_id - Multas de usuario específico
router.get(
  "/user/:user_id",
  requireStaff, // Solo bibliotecarios y admin
  requirePaymentPermissions("view_user_fines"),
  searchRateLimit,
  finesController.getUserFines
);

// RUTAS PARA USUARIOS (Solo sus propias multas)

// GET /api/fines/my-fines - Ver solo mis multas pendientes
router.get(
  "/my-fines",
  requirePaymentPermissions("view_own_fines"),
  searchRateLimit,
  finesController.getMyFines
);

// GET /api/fines/my-history - Historial de mis multas
router.get(
  "/my-history",
  requirePaymentPermissions("view_own_fines"),
  searchRateLimit,
  finesController.getMyFineHistory
);

// RUTAS DE REPORTES FINANCIEROS (Solo admin)

// GET /api/fines/revenue-stats - Estadísticas de ingresos por multas
router.get(
  "/revenue-stats",
  requireAdmin, // Solo administradores
  requirePaymentPermissions("view_financial_reports"),
  reportsRateLimit,
  finesController.getRevenueStats
);

// GET /api/fines/monthly-report - Reporte mensual de multas
router.get(
  "/monthly-report",
  requireAdmin, // Solo administradores
  requirePaymentPermissions("view_financial_reports"),
  reportsRateLimit,
  finesController.getMonthlyReport
);

// Middleware de manejo de errores específico para multas
router.use((error, req, res, next) => {
  const logger = require("../utils/logger");

  // Log errores específicos de multas
  if (error.statusCode >= 400) {
    logger.security(
      "Fines route error",
      {
        error: error.message,
        statusCode: error.statusCode,
        url: req.originalUrl,
        method: req.method,
        user_id: req.user?.id,
        user_role: req.user?.role,
        fine_id: req.params?.id,
        target_user: req.params?.user_id,
      },
      req
    );
  }

  next(error);
});

module.exports = router;
