const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/auth");
const {
  requireAdmin,
  requireStaff,
  requireUser,
} = require("../middleware/roleAuth");
const {
  reportsRateLimit,
  searchRateLimit,
} = require("../middleware/rateLimiter");

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireUser);

// DASHBOARDS POR ROL

// GET /api/dashboard/user - Dashboard personalizado para usuarios
router.get(
  "/user",
  searchRateLimit, // Rate limiting más permisivo para dashboards
  dashboardController.getUserDashboard
);

// GET /api/dashboard/librarian - Dashboard operativo para bibliotecarios
router.get(
  "/librarian",
  requireStaff, // Solo bibliotecarios y admin
  searchRateLimit,
  dashboardController.getLibrarianDashboard
);

// GET /api/dashboard/admin - Dashboard completo para administradores
router.get(
  "/admin",
  requireAdmin, // Solo administradores
  searchRateLimit,
  dashboardController.getAdminDashboard
);

// REPORTES DETALLADOS (Solo admin)

// GET /api/dashboard/reports/monthly - Reporte mensual detallado
router.get(
  "/reports/monthly",
  requireAdmin, // Solo administradores
  reportsRateLimit, // Rate limiting más restrictivo para reportes
  dashboardController.getMonthlyReport
);

// GET /api/dashboard/reports/users-activity - Reporte de actividad de usuarios
router.get(
  "/reports/users-activity",
  requireAdmin, // Solo administradores
  reportsRateLimit,
  dashboardController.getUserActivityReport
);

// Middleware de manejo de errores específico para dashboard
router.use((error, req, res, next) => {
  const logger = require("../utils/logger");

  // Log errores específicos del dashboard
  if (error.statusCode >= 400) {
    logger.security(
      "Dashboard route error",
      {
        error: error.message,
        statusCode: error.statusCode,
        url: req.originalUrl,
        method: req.method,
        user_id: req.user?.id,
        user_role: req.user?.role,
        dashboard_type: req.originalUrl.split("/").pop(),
      },
      req
    );
  }

  next(error);
});

module.exports = router;
