const { hasPermission } = require("../utils/auth");
const {
  createAuthenticationError,
  createAuthorizationError,
} = require("./errorHandler");
const logger = require("../utils/logger");

// Middleware para requerir rol específico
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        logger.security(
          "Role check attempted without authentication",
          {
            required_role: requiredRole,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
          },
          req
        );

        return next(createAuthenticationError("Autenticación requerida"));
      }

      if (!hasPermission(req.user.role, requiredRole)) {
        logger.security(
          "Access denied - insufficient role",
          {
            user_id: req.user.id,
            user_role: req.user.role,
            required_role: requiredRole,
            url: req.originalUrl,
            method: req.method,
          },
          req
        );

        return next(
          createAuthorizationError(
            `Acceso denegado: se requiere rol ${requiredRole}`
          )
        );
      }

      next();
    } catch (error) {
      logger.error("Role verification error:", error.message);
      next(createAuthorizationError("Error al verificar rol"));
    }
  };
};

// Middleware para permitir múltiples roles
const requireAnyRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createAuthenticationError("Autenticación requerida"));
      }

      if (!Array.isArray(allowedRoles)) {
        allowedRoles = [allowedRoles];
      }

      const userHasAllowedRole = allowedRoles.includes(req.user.role);

      if (!userHasAllowedRole) {
        logger.security(
          "Access denied - role not in allowed list",
          {
            user_id: req.user.id,
            user_role: req.user.role,
            allowed_roles: allowedRoles,
            url: req.originalUrl,
            method: req.method,
          },
          req
        );

        return next(
          createAuthorizationError(
            `Acceso denegado: se requiere uno de estos roles: ${allowedRoles.join(
              ", "
            )}`
          )
        );
      }

      next();
    } catch (error) {
      logger.error("Multiple role verification error:", error.message);
      next(createAuthorizationError("Error al verificar roles"));
    }
  };
};

// Middleware para solo admin
const requireAdmin = requireRole("admin");

// Middleware para admin o librarian
const requireStaff = requireAnyRole(["admin", "librarian"]);

// Middleware para cualquier usuario autenticado
const requireUser = (req, res, next) => {
  try {
    if (!req.user) {
      return next(createAuthenticationError("Autenticación requerida"));
    }

    // Verificar que el usuario tiene un rol válido
    const validRoles = ["admin", "librarian", "user"];
    if (!validRoles.includes(req.user.role)) {
      logger.security(
        "Invalid user role detected",
        {
          user_id: req.user.id,
          invalid_role: req.user.role,
          url: req.originalUrl,
          method: req.method,
        },
        req
      );

      return next(createAuthorizationError("Rol de usuario inválido"));
    }

    next();
  } catch (error) {
    logger.error("User role verification error:", error.message);
    next(createAuthorizationError("Error al verificar usuario"));
  }
};

// Middleware para verificar permisos específicos basados en contexto
const requirePermissionFor = (operation) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createAuthenticationError("Autenticación requerida"));
      }

      let hasAccess = false;
      const userRole = req.user.role;

      switch (operation) {
        case "manage_users":
          hasAccess = userRole === "admin";
          break;

        case "manage_catalog":
          hasAccess = ["admin", "librarian"].includes(userRole);
          break;

        case "process_loans":
          hasAccess = ["admin", "librarian"].includes(userRole);
          break;

        case "view_reports":
          hasAccess = ["admin", "librarian"].includes(userRole);
          break;

        case "manage_fines":
          hasAccess = ["admin", "librarian"].includes(userRole);
          break;

        case "access_audit_logs":
          hasAccess = userRole === "admin";
          break;

        case "view_own_data":
          hasAccess = true; // Todos los usuarios autenticados
          break;

        default:
          hasAccess = false;
          logger.warn("Unknown operation for permission check:", operation);
      }

      if (!hasAccess) {
        logger.security(
          "Access denied - operation permission",
          {
            user_id: req.user.id,
            user_role: req.user.role,
            operation: operation,
            url: req.originalUrl,
            method: req.method,
          },
          req
        );

        return next(
          createAuthorizationError(
            `Acceso denegado: no tienes permisos para ${operation}`
          )
        );
      }

      next();
    } catch (error) {
      logger.error("Permission verification error:", error.message);
      next(createAuthorizationError("Error al verificar permisos"));
    }
  };
};

// Middleware para verificar acceso a recursos propios vs ajenos
const requireSelfOrRole = (allowedRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createAuthenticationError("Autenticación requerida"));
      }

      const targetUserId =
        req.params.userId || req.params.id || req.body.user_id;

      // Si es el mismo usuario, permitir acceso
      if (parseInt(targetUserId) === req.user.id) {
        return next();
      }

      // Si no es el mismo usuario, verificar rol
      if (!hasPermission(req.user.role, allowedRole)) {
        logger.security(
          "Access denied - not self and insufficient role",
          {
            user_id: req.user.id,
            user_role: req.user.role,
            target_user: targetUserId,
            required_role: allowedRole,
            url: req.originalUrl,
            method: req.method,
          },
          req
        );

        return next(
          createAuthorizationError(
            "Solo puedes acceder a tus propios datos o necesitas rol de " +
              allowedRole
          )
        );
      }

      next();
    } catch (error) {
      logger.error("Self or role verification error:", error.message);
      next(createAuthorizationError("Error al verificar acceso"));
    }
  };
};

// Middleware para operaciones que solo puede hacer el usuario sobre sí mismo
const requireSelfOnly = (req, res, next) => {
  try {
    if (!req.user) {
      return next(createAuthenticationError("Autenticación requerida"));
    }

    const targetUserId = req.params.userId || req.params.id || req.body.user_id;

    // Admin puede hacer operaciones en nombre de otros usuarios
    if (req.user.role === "admin") {
      return next();
    }

    if (parseInt(targetUserId) !== req.user.id) {
      logger.security(
        "Access denied - self-only operation attempted",
        {
          user_id: req.user.id,
          target_user: targetUserId,
          url: req.originalUrl,
          method: req.method,
        },
        req
      );

      return next(
        createAuthorizationError(
          "Esta operación solo puede realizarse en tu propia cuenta"
        )
      );
    }

    next();
  } catch (error) {
    logger.error("Self-only verification error:", error.message);
    next(createAuthorizationError("Error al verificar acceso"));
  }
};

// Middleware para logging de acciones privilegiadas
const logPrivilegedAction = (actionDescription) => {
  return (req, res, next) => {
    if (req.user) {
      logger.audit(
        "Privileged action attempted",
        {
          user_id: req.user.id,
          user_role: req.user.role,
          action: actionDescription,
          url: req.originalUrl,
          method: req.method,
          timestamp: new Date().toISOString(),
        },
        req
      );
    }

    next();
  };
};

// Middleware para verificar acceso basado en método HTTP y rol
const requireRoleForMethod = (rolePermissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createAuthenticationError("Autenticación requerida"));
      }

      const method = req.method.toUpperCase();
      const requiredRole = rolePermissions[method];

      if (!requiredRole) {
        logger.warn("No role defined for method:", method);
        return next(createAuthorizationError("Método no permitido"));
      }

      if (!hasPermission(req.user.role, requiredRole)) {
        logger.security(
          "Access denied - method role permission",
          {
            user_id: req.user.id,
            user_role: req.user.role,
            method: method,
            required_role: requiredRole,
            url: req.originalUrl,
          },
          req
        );

        return next(
          createAuthorizationError(
            `Acceso denegado: ${method} requiere rol ${requiredRole}`
          )
        );
      }

      next();
    } catch (error) {
      logger.error("Method role verification error:", error.message);
      next(createAuthorizationError("Error al verificar permisos de método"));
    }
  };
};

module.exports = {
  requireRole,
  requireAnyRole,
  requireAdmin,
  requireStaff,
  requireUser,
  requirePermissionFor,
  requireSelfOrRole,
  requireSelfOnly,
  logPrivilegedAction,
  requireRoleForMethod,
};
