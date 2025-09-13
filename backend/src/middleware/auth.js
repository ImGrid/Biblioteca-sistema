const { verifyToken, extractTokenFromHeader } = require("../utils/auth");
const {
  createAuthenticationError,
  createAuthorizationError,
} = require("./errorHandler");
const logger = require("../utils/logger");

// Middleware principal de autenticación
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      logger.security(
        "Authentication attempt without token",
        {
          url: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        req
      );

      return next(createAuthenticationError("Token de acceso requerido"));
    }

    const tokenVerification = verifyToken(token);

    if (!tokenVerification.valid) {
      logger.security(
        "Authentication failed - invalid token",
        {
          error: tokenVerification.error,
          url: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        req
      );

      return next(createAuthenticationError(tokenVerification.error));
    }

    // Agregar información del usuario al request
    req.user = tokenVerification.payload;
    req.token = token;

    // Log de autenticación exitosa solo para operaciones importantes
    if (req.method !== "GET" || req.originalUrl.includes("/admin/")) {
      logger.audit(
        "User authenticated",
        {
          user_id: req.user.id,
          user_role: req.user.role,
          action: `${req.method} ${req.originalUrl}`,
        },
        req
      );
    }

    next();
  } catch (error) {
    logger.error("Authentication middleware error:", error.message);
    next(createAuthenticationError("Error en autenticación"));
  }
};

// Middleware de autenticación opcional (para rutas que pueden funcionar con o sin autenticación)
const optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No hay token, continúa sin usuario autenticado
      req.user = null;
      return next();
    }

    const tokenVerification = verifyToken(token);

    if (tokenVerification.valid) {
      req.user = tokenVerification.payload;
      req.token = token;
    } else {
      req.user = null;
      // Log solo si el token parece malicioso
      if (token.length > 10) {
        logger.security(
          "Invalid token in optional auth",
          {
            error: tokenVerification.error,
            url: req.originalUrl,
          },
          req
        );
      }
    }

    next();
  } catch (error) {
    logger.error("Optional authentication middleware error:", error.message);
    req.user = null;
    next();
  }
};

// Middleware para verificar que el usuario está activo
const requireActiveUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createAuthenticationError("Usuario no autenticado"));
    }

    // En una implementación más avanzada, aquí verificaríamos en BD si el usuario sigue activo
    // Por ahora, confiamos en que el token es válido

    next();
  } catch (error) {
    logger.error("Active user verification error:", error.message);
    next(createAuthenticationError("Error al verificar usuario"));
  }
};

// Middleware para verificar que el token no esté cerca de expirar
const checkTokenExpiry = (req, res, next) => {
  try {
    if (!req.token) {
      return next();
    }

    const { isTokenNearExpiry } = require("../utils/auth");

    if (isTokenNearExpiry(req.token, 30)) {
      // 30 minutos antes de expirar
      res.setHeader("X-Token-Warning", "Token expires soon");

      logger.info("Token near expiry warning", {
        user_id: req.user?.id,
        expires_in: "< 30 minutes",
      });
    }

    next();
  } catch (error) {
    logger.error("Token expiry check error:", error.message);
    next();
  }
};

// Middleware para logging detallado de acceso (solo para rutas administrativas)
const logAdminAccess = (req, res, next) => {
  if (req.user) {
    logger.audit(
      "Admin area access",
      {
        user_id: req.user.id,
        user_role: req.user.role,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      },
      req
    );
  }

  next();
};

// Middleware para verificar permisos específicos sobre recursos
const requireResourcePermission = (resource, action = "read") => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createAuthenticationError("Usuario no autenticado"));
      }

      const { canAccessResource } = require("../utils/auth");

      if (!canAccessResource(req.user, resource, action)) {
        logger.security(
          "Access denied - insufficient permissions",
          {
            user_id: req.user.id,
            user_role: req.user.role,
            required_resource: resource,
            required_action: action,
            url: req.originalUrl,
            method: req.method,
          },
          req
        );

        return next(
          createAuthorizationError(
            `Acceso denegado: se requiere permiso ${action} en ${resource}`
          )
        );
      }

      next();
    } catch (error) {
      logger.error("Resource permission check error:", error.message);
      next(createAuthorizationError("Error al verificar permisos"));
    }
  };
};

// Middleware para verificar acceso a datos de usuario específico
const requireUserDataAccess = (req, res, next) => {
  try {
    if (!req.user) {
      return next(createAuthenticationError("Usuario no autenticado"));
    }

    const targetUserId = req.params.userId || req.params.id || req.body.user_id;

    if (!targetUserId) {
      return next(createAuthorizationError("ID de usuario requerido"));
    }

    const { canAccessUserData } = require("../utils/auth");

    if (!canAccessUserData(req.user, targetUserId)) {
      logger.security(
        "Access denied - user data access",
        {
          requesting_user: req.user.id,
          requesting_role: req.user.role,
          target_user: targetUserId,
          url: req.originalUrl,
          method: req.method,
        },
        req
      );

      return next(
        createAuthorizationError("No tienes permiso para acceder a estos datos")
      );
    }

    next();
  } catch (error) {
    logger.error("User data access check error:", error.message);
    next(createAuthorizationError("Error al verificar acceso a datos"));
  }
};

// Middleware para rate limiting específico de usuarios autenticados
const authenticatedUserRateLimit = (maxRequests, windowMs, identifier) => {
  return (req, res, next) => {
    // Si hay usuario autenticado, usar rate limiting por usuario
    if (req.user) {
      const { createUserRateLimit } = require("./rateLimiter");
      const userRateLimit = createUserRateLimit(
        maxRequests,
        windowMs,
        identifier
      );
      return userRateLimit(req, res, next);
    }

    // Si no hay usuario, usar rate limiting por IP más restrictivo
    const { generalRateLimit } = require("./rateLimiter");
    return generalRateLimit(req, res, next);
  };
};

// Middleware para verificar que el usuario es el propietario del recurso
const requireOwnership = (resourceIdField = "user_id") => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createAuthenticationError("Usuario no autenticado"));
      }

      // Admin puede acceder a todo
      if (req.user.role === "admin") {
        return next();
      }

      const resourceUserId =
        req.body[resourceIdField] ||
        req.params[resourceIdField] ||
        req.query[resourceIdField];

      if (!resourceUserId) {
        return next(createAuthorizationError("ID de propietario requerido"));
      }

      if (parseInt(resourceUserId) !== req.user.id) {
        logger.security(
          "Access denied - resource ownership",
          {
            user_id: req.user.id,
            resource_user_id: resourceUserId,
            resource_field: resourceIdField,
            url: req.originalUrl,
            method: req.method,
          },
          req
        );

        return next(
          createAuthorizationError("Solo puedes acceder a tus propios recursos")
        );
      }

      next();
    } catch (error) {
      logger.error("Ownership verification error:", error.message);
      next(createAuthorizationError("Error al verificar propiedad"));
    }
  };
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireActiveUser,
  checkTokenExpiry,
  logAdminAccess,
  requireResourcePermission,
  requireUserDataAccess,
  authenticatedUserRateLimit,
  requireOwnership,
};
