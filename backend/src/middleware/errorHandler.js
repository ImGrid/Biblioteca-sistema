const logger = require("../utils/logger");

// Códigos de error estándar
const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  ACCESS_DENIED: "ACCESS_DENIED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  DATABASE_ERROR: "DATABASE_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INVALID_INPUT: "INVALID_INPUT",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
};

// Mapear códigos de PostgreSQL a errores de aplicación
const mapPostgresError = (pgError) => {
  switch (pgError.code) {
    case "23505": // unique_violation
      return {
        statusCode: 409,
        errorCode: ERROR_CODES.DUPLICATE_RESOURCE,
        message: "El recurso ya existe",
        details: "Violación de restricción única",
      };
    case "23503": // foreign_key_violation
      return {
        statusCode: 400,
        errorCode: ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: "Referencia inválida",
        details: "Violación de clave foránea",
      };
    case "23502": // not_null_violation
      return {
        statusCode: 400,
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        message: "Campo requerido faltante",
        details: "Violación de campo obligatorio",
      };
    case "23514": // check_violation
      return {
        statusCode: 400,
        errorCode: ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: "Violación de regla de negocio",
        details: "Violación de restricción de verificación",
      };
    case "42P01": // undefined_table
      return {
        statusCode: 500,
        errorCode: ERROR_CODES.DATABASE_ERROR,
        message: "Error de configuración de base de datos",
        details: "Tabla no encontrada",
      };
    case "42703": // undefined_column
      return {
        statusCode: 500,
        errorCode: ERROR_CODES.DATABASE_ERROR,
        message: "Error de configuración de base de datos",
        details: "Columna no encontrada",
      };
    default:
      return {
        statusCode: 500,
        errorCode: ERROR_CODES.DATABASE_ERROR,
        message: "Error de base de datos",
        details: "Error interno de base de datos",
      };
  }
};

// Crear error de aplicación personalizado
class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details = null
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Crear errores específicos
const createValidationError = (message, errors = null) => {
  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, errors);
};

const createAuthenticationError = (message = "Credenciales inválidas") => {
  return new AppError(message, 401, ERROR_CODES.AUTHENTICATION_FAILED);
};

const createAuthorizationError = (message = "Acceso denegado") => {
  return new AppError(message, 403, ERROR_CODES.ACCESS_DENIED);
};

const createNotFoundError = (resource = "Recurso") => {
  return new AppError(
    `${resource} no encontrado`,
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND
  );
};

const createDuplicateError = (resource = "Recurso") => {
  return new AppError(
    `${resource} ya existe`,
    409,
    ERROR_CODES.DUPLICATE_RESOURCE
  );
};

const createRateLimitError = (message = "Demasiadas solicitudes") => {
  return new AppError(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED);
};

const createBusinessRuleError = (message) => {
  return new AppError(message, 400, ERROR_CODES.BUSINESS_RULE_VIOLATION);
};

// Middleware de manejo de errores
const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = "Error interno del servidor";
  let details = null;

  // Log del error completo para debugging
  logger.error("Error caught by errorHandler:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    user: req.user ? { id: req.user.id, role: req.user.role } : null,
  });

  // Manejar errores personalizados de la aplicación
  if (error.isOperational) {
    statusCode = error.statusCode;
    errorCode = error.errorCode;
    message = error.message;
    details = error.details;
  }
  // Manejar errores de PostgreSQL
  else if (error.code && error.code.length === 5) {
    const pgError = mapPostgresError(error);
    statusCode = pgError.statusCode;
    errorCode = pgError.errorCode;
    message = pgError.message;
    details = pgError.details;
  }
  // Manejar errores de JWT
  else if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    errorCode = ERROR_CODES.AUTHENTICATION_FAILED;
    message = "Token inválido";
  } else if (error.name === "TokenExpiredError") {
    statusCode = 401;
    errorCode = ERROR_CODES.AUTHENTICATION_FAILED;
    message = "Token expirado";
  }
  // Manejar errores de validación de mongoose-style
  else if (error.name === "ValidationError") {
    statusCode = 400;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = "Error de validación";
    details = error.errors;
  }
  // Manejar errores de sintaxis JSON
  else if (error.name === "SyntaxError" && error.message.includes("JSON")) {
    statusCode = 400;
    errorCode = ERROR_CODES.INVALID_INPUT;
    message = "JSON inválido";
  }

  // Log de seguridad para errores críticos
  if (statusCode >= 500) {
    logger.security(
      "Critical error occurred",
      {
        error: error.message,
        statusCode,
        errorCode,
        url: req.url,
        method: req.method,
      },
      req
    );
  }

  // Preparar respuesta
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
    },
  };

  // Agregar detalles solo en desarrollo o para ciertos tipos de error
  if (process.env.NODE_ENV === "development" || statusCode < 500) {
    if (details) {
      errorResponse.error.details = details;
    }

    // Stack trace solo en desarrollo
    if (process.env.NODE_ENV === "development") {
      errorResponse.error.stack = error.stack;
    }
  }

  res.status(statusCode).json(errorResponse);
};

// Middleware para manejar rutas no encontradas
const notFoundHandler = (req, res, next) => {
  const error = createNotFoundError(`Ruta ${req.method} ${req.originalUrl}`);
  next(error);
};

// Wrapper para async handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware para validar entrada
const validateRequest = (validationFunction) => {
  return (req, res, next) => {
    try {
      const validation = validationFunction(req.body);

      if (!validation.valid) {
        const error = createValidationError(
          "Datos de entrada inválidos",
          validation.errors
        );
        return next(error);
      }

      // Reemplazar req.body con datos validados y sanitizados
      req.body = validation.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware para validar parámetros de URL
const validateParams = (paramValidators) => {
  return (req, res, next) => {
    try {
      const errors = {};
      const validatedParams = {};

      Object.entries(paramValidators).forEach(([param, validator]) => {
        const value = req.params[param];
        const result = validator(value);

        if (!result.valid) {
          errors[param] = result.error;
        } else {
          validatedParams[param] = result.value;
        }
      });

      if (Object.keys(errors).length > 0) {
        const error = createValidationError("Parámetros inválidos", errors);
        return next(error);
      }

      // Reemplazar parámetros con valores validados
      req.params = { ...req.params, ...validatedParams };
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validateRequest,
  validateParams,
  AppError,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createDuplicateError,
  createRateLimitError,
  createBusinessRuleError,
  ERROR_CODES,
};
