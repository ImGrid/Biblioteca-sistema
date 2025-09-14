const express = require("express");
const router = express.Router();

const loansController = require("../controllers/loansController");
const { authenticate } = require("../middleware/auth");
const {
  requireAdmin,
  requireStaff,
  requireUser,
} = require("../middleware/roleAuth");
const {
  loanOperationsRateLimit,
  searchRateLimit,
  reportsRateLimit,
} = require("../middleware/rateLimiter");
const { validateRequest } = require("../middleware/errorHandler");

// Importar middlewares de validación específicos de préstamos
const {
  validateLoanData,
  validateReturnData,
  validateExtensionData,
  requireLoanPermissions,
  requireLoanAccess,
  requireUserLoanAccess,
  validateLoanSearchParams,
  logLoanOperation,
} = require("../middleware/loanValidation");

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireUser);

// RUTAS PARA BIBLIOTECARIOS Y ADMIN (Gestión de préstamos)

// POST /api/loans - Procesar nuevo préstamo
router.post(
  "/",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("process_loans"),
  loanOperationsRateLimit,
  validateRequest(validateLoanData),
  logLoanOperation("create_loan"),
  loansController.createLoan
);

// PUT /api/loans/:id/return - Procesar devolución
router.put(
  "/:id/return",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("process_returns"),
  loanOperationsRateLimit,
  validateRequest(validateReturnData),
  logLoanOperation("return_loan"),
  loansController.returnLoan
);

// PUT /api/loans/:id/extend - Extender préstamo
router.put(
  "/:id/extend",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("extend_loans"),
  loanOperationsRateLimit,
  validateRequest(validateExtensionData),
  logLoanOperation("extend_loan"),
  loansController.extendLoanDuration
);

// GET /api/loans/active - Préstamos activos con filtros
router.get(
  "/active",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("access_all_loans"),
  searchRateLimit,
  validateLoanSearchParams,
  loansController.getActiveLoans
);

// GET /api/loans/overdue - Préstamos vencidos
router.get(
  "/overdue",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("access_all_loans"),
  searchRateLimit,
  loansController.getOverdueLoans
);

// GET /api/loans/user/:user_id - Préstamos de usuario específico
router.get(
  "/user/:user_id",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("access_all_loans"),
  requireUserLoanAccess,
  searchRateLimit,
  loansController.getUserLoans
);

// RUTAS PARA USUARIOS (Solo sus propios préstamos)

// GET /api/loans/my-loans - Mis préstamos activos
router.get(
  "/my-loans",
  requireLoanPermissions("view_own_loans"),
  searchRateLimit,
  loansController.getMyLoans
);

// GET /api/loans/my-history - Mi historial completo de préstamos
router.get(
  "/my-history",
  requireLoanPermissions("view_own_loans"),
  searchRateLimit,
  loansController.getMyLoanHistory
);

// RUTAS DE REPORTES Y ESTADÍSTICAS (Solo staff)

// GET /api/loans/stats - Estadísticas de préstamos
router.get(
  "/stats",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("generate_reports"),
  reportsRateLimit,
  loansController.getLoansStats
);

// POST /api/loans/generate-fines - Generar multas automáticas (Solo admin)
router.post(
  "/generate-fines",
  requireAdmin, // Solo administradores
  reportsRateLimit,
  logLoanOperation("generate_fines"),
  loansController.generateFines
);

// RUTAS DE UTILIDADES

// POST /api/loans/check-eligibility - Verificar elegibilidad de préstamo
router.post(
  "/check-eligibility",
  requireStaff, // Solo bibliotecarios y admin
  requireLoanPermissions("process_loans"),
  loanOperationsRateLimit,
  loansController.checkEligibility
);

// Middleware de manejo de errores específico para préstamos
router.use((error, req, res, next) => {
  const logger = require("../utils/logger");

  // Log errores específicos de préstamos
  if (error.statusCode >= 400) {
    logger.security(
      "Loans route error",
      {
        error: error.message,
        statusCode: error.statusCode,
        url: req.originalUrl,
        method: req.method,
        user_id: req.user?.id,
        user_role: req.user?.role,
        loan_id: req.params?.id,
        target_user: req.params?.user_id || req.body?.user_id,
      },
      req
    );
  }

  next(error);
});

module.exports = router;
