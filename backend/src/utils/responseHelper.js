const logger = require("./logger");

// Respuesta exitosa estándar
const success = (
  res,
  data = null,
  message = "Operación exitosa",
  statusCode = 200,
  meta = {}
) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Solo incluir data si no es null
  if (data !== null) {
    response.data = data;
  }

  // Log de respuesta exitosa para auditoría
  if (statusCode >= 200 && statusCode < 300) {
    logger.debug(`Success response: ${statusCode} - ${message}`);
  }

  return res.status(statusCode).json(response);
};

// Respuesta de error estándar (ya manejada por errorHandler, pero útil para casos específicos)
const error = (
  res,
  message = "Error en la operación",
  statusCode = 500,
  code = "INTERNAL_ERROR",
  details = null
) => {
  const response = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  };

  if (details) {
    response.error.details = details;
  }

  logger.warn(`Error response: ${statusCode} - ${code} - ${message}`);

  return res.status(statusCode).json(response);
};

// Respuesta para recursos creados
const created = (
  res,
  data,
  message = "Recurso creado exitosamente",
  location = null
) => {
  const meta = {};

  if (location) {
    res.setHeader("Location", location);
    meta.location = location;
  }

  return success(res, data, message, 201, meta);
};

// Respuesta para operaciones sin contenido
const noContent = (res, message = "Operación completada") => {
  logger.debug(`No content response: ${message}`);
  return res.status(204).end();
};

// Respuesta para lista con paginación
const paginated = (
  res,
  data,
  pagination,
  message = "Datos obtenidos exitosamente"
) => {
  const meta = {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
      hasNext: pagination.hasNext,
      hasPrev: pagination.hasPrev,
    },
  };

  return success(res, data, message, 200, meta);
};

// Respuesta de validación fallida
const validationError = (
  res,
  errors,
  message = "Datos de entrada inválidos"
) => {
  return error(res, message, 400, "VALIDATION_ERROR", errors);
};

// Respuesta de autenticación requerida
const unauthorized = (res, message = "Autenticación requerida") => {
  return error(res, message, 401, "AUTHENTICATION_REQUIRED");
};

// Respuesta de acceso denegado
const forbidden = (res, message = "Acceso denegado") => {
  return error(res, message, 403, "ACCESS_DENIED");
};

// Respuesta de recurso no encontrado
const notFound = (res, resource = "Recurso", message = null) => {
  const msg = message || `${resource} no encontrado`;
  return error(res, msg, 404, "RESOURCE_NOT_FOUND");
};

// Respuesta de conflicto (recurso ya existe)
const conflict = (res, message = "El recurso ya existe") => {
  return error(res, message, 409, "RESOURCE_CONFLICT");
};

// Respuesta de rate limiting
const tooManyRequests = (
  res,
  message = "Demasiadas solicitudes",
  retryAfter = null
) => {
  if (retryAfter) {
    res.setHeader("Retry-After", retryAfter);
  }

  return error(res, message, 429, "RATE_LIMIT_EXCEEDED");
};

// Respuesta para errores de servidor
const serverError = (res, message = "Error interno del servidor") => {
  return error(res, message, 500, "INTERNAL_SERVER_ERROR");
};

// Wrapper para respuestas de base de datos
const fromDatabaseResult = (
  res,
  dbResult,
  successMessage = "Operación exitosa",
  notFoundMessage = "Recurso no encontrado"
) => {
  if (!dbResult.success) {
    logger.error("Database operation failed:", dbResult.error);
    return serverError(res, "Error en la base de datos");
  }

  if (dbResult.rowCount === 0 || !dbResult.data) {
    return notFound(res, null, notFoundMessage);
  }

  return success(res, dbResult.data, successMessage);
};

// Wrapper para operaciones de creación en BD
const fromDatabaseCreation = (
  res,
  dbResult,
  resourceName = "Recurso",
  locationBuilder = null
) => {
  if (!dbResult.success) {
    // Manejar errores específicos de PostgreSQL
    if (dbResult.code === "23505") {
      return conflict(res, `${resourceName} ya existe`);
    }

    logger.error("Database creation failed:", dbResult.error);
    return serverError(res, "Error al crear el recurso");
  }

  const location = locationBuilder ? locationBuilder(dbResult.data) : null;
  return created(
    res,
    dbResult.data,
    `${resourceName} creado exitosamente`,
    location
  );
};

// Wrapper para operaciones de actualización en BD
const fromDatabaseUpdate = (res, dbResult, resourceName = "Recurso") => {
  if (!dbResult.success) {
    logger.error("Database update failed:", dbResult.error);
    return serverError(res, "Error al actualizar el recurso");
  }

  if (dbResult.rowCount === 0) {
    return notFound(res, resourceName);
  }

  return success(
    res,
    dbResult.data,
    `${resourceName} actualizado exitosamente`
  );
};

// Wrapper para operaciones de eliminación en BD
const fromDatabaseDeletion = (res, dbResult, resourceName = "Recurso") => {
  if (!dbResult.success) {
    logger.error("Database deletion failed:", dbResult.error);
    return serverError(res, "Error al eliminar el recurso");
  }

  if (dbResult.rowCount === 0) {
    return notFound(res, resourceName);
  }

  return success(res, null, `${resourceName} eliminado exitosamente`);
};

// Wrapper para listas paginadas desde BD
const fromDatabasePaginated = (
  res,
  dbResult,
  message = "Datos obtenidos exitosamente"
) => {
  if (!dbResult.success) {
    logger.error("Database paginated query failed:", dbResult.error);
    return serverError(res, "Error al obtener los datos");
  }

  return paginated(res, dbResult.data, dbResult.pagination, message);
};

// Respuesta de estado de salud del sistema
const healthCheck = (res, checks = {}) => {
  const overallStatus = Object.values(checks).every(
    (check) => check.status === "healthy"
  )
    ? "healthy"
    : "unhealthy";

  const response = {
    success: true,
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = overallStatus === "healthy" ? 200 : 503;

  return res.status(statusCode).json(response);
};

// Helper para respuestas de autenticación
const authSuccess = (res, token, user, message = "Autenticación exitosa") => {
  const data = {
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    },
  };

  // Log de autenticación exitosa
  logger.audit("User authenticated successfully", {
    user_id: user.id,
    user_role: user.role,
  });

  return success(res, data, message);
};

// Helper para respuestas de logout
const logoutSuccess = (res, message = "Sesión cerrada exitosamente") => {
  return success(res, null, message);
};

// Middleware para agregar helpers de respuesta al objeto res
const attachResponseHelpers = (req, res, next) => {
  res.success = (data, message, statusCode, meta) =>
    success(res, data, message, statusCode, meta);
  res.error = (message, statusCode, code, details) =>
    error(res, message, statusCode, code, details);
  res.created = (data, message, location) =>
    created(res, data, message, location);
  res.noContent = (message) => noContent(res, message);
  res.paginated = (data, pagination, message) =>
    paginated(res, data, pagination, message);
  res.validationError = (errors, message) =>
    validationError(res, errors, message);
  res.unauthorized = (message) => unauthorized(res, message);
  res.forbidden = (message) => forbidden(res, message);
  res.notFound = (resource, message) => notFound(res, resource, message);
  res.conflict = (message) => conflict(res, message);
  res.tooManyRequests = (message, retryAfter) =>
    tooManyRequests(res, message, retryAfter);
  res.serverError = (message) => serverError(res, message);
  res.fromDatabase = (dbResult, successMessage, notFoundMessage) =>
    fromDatabaseResult(res, dbResult, successMessage, notFoundMessage);
  res.fromDatabaseCreation = (dbResult, resourceName, locationBuilder) =>
    fromDatabaseCreation(res, dbResult, resourceName, locationBuilder);
  res.fromDatabaseUpdate = (dbResult, resourceName) =>
    fromDatabaseUpdate(res, dbResult, resourceName);
  res.fromDatabaseDeletion = (dbResult, resourceName) =>
    fromDatabaseDeletion(res, dbResult, resourceName);
  res.fromDatabasePaginated = (dbResult, message) =>
    fromDatabasePaginated(res, dbResult, message);
  res.healthCheck = (checks) => healthCheck(res, checks);
  res.authSuccess = (token, user, message) =>
    authSuccess(res, token, user, message);
  res.logoutSuccess = (message) => logoutSuccess(res, message);

  next();
};

module.exports = {
  success,
  error,
  created,
  noContent,
  paginated,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  serverError,
  fromDatabaseResult,
  fromDatabaseCreation,
  fromDatabaseUpdate,
  fromDatabaseDeletion,
  fromDatabasePaginated,
  healthCheck,
  authSuccess,
  logoutSuccess,
  attachResponseHelpers,
};
