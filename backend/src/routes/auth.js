const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { requireAdmin, requireUser } = require("../middleware/roleAuth");
const {
  authRateLimit,
  passwordChangeRateLimit,
} = require("../middleware/rateLimiter");
const { validateRequest } = require("../middleware/errorHandler");

// IMPORTS CORREGIDOS - Importar funciones de validación
const {
  validateUserRegistration,
  validateName,
  validatePhone,
  validateString,
} = require("../utils/validation");

// Validación específica para login
const validateLogin = (data) => {
  const errors = {};

  if (
    !data.email ||
    typeof data.email !== "string" ||
    data.email.trim().length === 0
  ) {
    errors.email = "Email es requerido";
  }

  if (
    !data.password ||
    typeof data.password !== "string" ||
    data.password.length === 0
  ) {
    errors.password = "Contraseña es requerida";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      email: data.email?.trim(),
      password: data.password,
    },
  };
};

// Validación para cambio de contraseña
const validatePasswordChange = (data) => {
  const errors = {};

  if (!data.current_password || typeof data.current_password !== "string") {
    errors.current_password = "Contraseña actual es requerida";
  }

  if (!data.new_password || typeof data.new_password !== "string") {
    errors.new_password = "Nueva contraseña es requerida";
  }

  if (data.new_password && data.new_password === data.current_password) {
    errors.new_password = "La nueva contraseña debe ser diferente a la actual";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      current_password: data.current_password,
      new_password: data.new_password,
    },
  };
};

// Validación para actualización de perfil
const validateProfileUpdate = (data) => {
  const errors = {};
  const validatedData = {};

  if (data.first_name !== undefined) {
    const firstNameValidation = validateName(data.first_name, "Nombre");
    if (!firstNameValidation.valid) {
      errors.first_name = firstNameValidation.error;
    } else {
      validatedData.first_name = firstNameValidation.value;
    }
  }

  if (data.last_name !== undefined) {
    const lastNameValidation = validateName(data.last_name, "Apellido");
    if (!lastNameValidation.valid) {
      errors.last_name = lastNameValidation.error;
    } else {
      validatedData.last_name = lastNameValidation.value;
    }
  }

  if (data.phone !== undefined) {
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.valid) {
      errors.phone = phoneValidation.error;
    } else {
      validatedData.phone = phoneValidation.value;
    }
  }

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

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// RUTAS PÚBLICAS (sin autenticación)

// POST /api/auth/register - Registro de nuevos usuarios
router.post(
  "/register",
  authRateLimit, // Rate limiting específico para auth
  validateRequest(validateUserRegistration), // CORREGIDO: Import ya disponible
  authController.register
);

// POST /api/auth/login - Inicio de sesión
router.post(
  "/login",
  authRateLimit, // Rate limiting específico para auth
  validateRequest(validateLogin),
  authController.login
);

// RUTAS PROTEGIDAS (requieren autenticación)

// GET /api/auth/me - Obtener perfil del usuario autenticado
router.get("/me", authenticate, requireUser, authController.getProfile);

// POST /api/auth/verify - Verificar validez del token
router.post("/verify", authenticate, requireUser, authController.verifyToken);

// POST /api/auth/logout - Cerrar sesión
router.post("/logout", authenticate, requireUser, authController.logout);

// PUT /api/auth/profile - Actualizar perfil del usuario
router.put(
  "/profile",
  authenticate,
  requireUser,
  validateRequest(validateProfileUpdate),
  authController.updateProfile
);

// PUT /api/auth/password - Cambiar contraseña
router.put(
  "/password",
  authenticate,
  requireUser,
  passwordChangeRateLimit, // Rate limiting específico para cambio de password
  validateRequest(validatePasswordChange),
  authController.changePassword
);

// RUTAS ADMINISTRATIVAS

// GET /api/auth/roles - Listar roles disponibles (solo admin)
router.get("/roles", authenticate, requireAdmin, authController.getRoles);

// Middleware de manejo de errores específico para rutas de auth
router.use((error, req, res, next) => {
  // Log específico para errores de autenticación
  if (error.statusCode === 401 || error.statusCode === 403) {
    const logger = require("../utils/logger");
    logger.security(
      "Authentication route error",
      {
        error: error.message,
        statusCode: error.statusCode,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      },
      req
    );
  }

  next(error);
});

module.exports = router;
