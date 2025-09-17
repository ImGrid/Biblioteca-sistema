const logger = require("../utils/logger");

// Store en memoria para rate limiting
const rateLimitStore = new Map();

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Configuraciones de rate limiting por tipo
const RATE_LIMIT_CONFIGS = {
  // Rate limiting general
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 10000,
    message: "Demasiadas solicitudes desde esta IP, intenta más tarde",
  },

  // Rate limiting para autenticación (más restrictivo)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 15,
    message: "Demasiados intentos de autenticación, intenta más tarde",
  },

  // Rate limiting para creación de recursos
  create: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 10000,
    message: "Demasiadas creaciones de recursos, intenta más tarde",
  },

  // Rate limiting para búsquedas
  search: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30,
    message: "Demasiadas búsquedas, intenta más tarde",
  },

  // Rate limiting para reportes (más restrictivo)
  reports: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 10,
    message: "Límite de reportes alcanzado, intenta más tarde",
  },
};

// Obtener IP del cliente (considerando proxies)
const getClientIP = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    "0.0.0.0"
  );
};

// Crear key única para rate limiting
const createRateLimitKey = (ip, identifier = "general") => {
  return `${identifier}:${ip}`;
};

// Middleware de rate limiting genérico
const createRateLimiter = (config) => {
  const { windowMs, maxRequests, message, identifier = "general" } = config;

  return (req, res, next) => {
    const ip = getClientIP(req);
    const key = createRateLimitKey(ip, identifier);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Obtener o crear entrada de rate limiting
    let rateLimitData = rateLimitStore.get(key);

    if (!rateLimitData || now > rateLimitData.resetTime) {
      // Crear nueva entrada o resetear expirada
      rateLimitData = {
        count: 0,
        resetTime,
        firstRequest: now,
      };
    }

    // Incrementar contador
    rateLimitData.count++;
    rateLimitStore.set(key, rateLimitData);

    // Calcular headers de rate limiting
    const remaining = Math.max(0, maxRequests - rateLimitData.count);
    const resetTimeSeconds = Math.ceil((rateLimitData.resetTime - now) / 1000);

    // Agregar headers informativos
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(rateLimitData.resetTime / 1000)
    );
    res.setHeader("X-RateLimit-Window", Math.ceil(windowMs / 1000));

    // Verificar si se excedió el límite
    if (rateLimitData.count > maxRequests) {
      // Log de seguridad
      logger.security(
        "Rate limit exceeded",
        {
          ip,
          identifier,
          count: rateLimitData.count,
          maxRequests,
          userAgent: req.get("User-Agent"),
          url: req.originalUrl,
          method: req.method,
        },
        req
      );

      res.setHeader("Retry-After", resetTimeSeconds);

      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message,
          retryAfter: resetTimeSeconds,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Log cuando se está cerca del límite
    if (rateLimitData.count > maxRequests * 0.8) {
      logger.warn(`Rate limit warning for ${ip}`, {
        identifier,
        count: rateLimitData.count,
        maxRequests,
        remaining,
      });
    }

    next();
  };
};

// Rate limiters específicos
const generalRateLimit = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.general,
  identifier: "general",
});

const authRateLimit = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.auth,
  identifier: "auth",
});

const createResourceRateLimit = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.create,
  identifier: "create",
});

const searchRateLimit = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.search,
  identifier: "search",
});

const reportsRateLimit = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.reports,
  identifier: "reports",
});

// Rate limiting específico por usuario autenticado
const createUserRateLimit = (maxRequests, windowMs, identifier) => {
  return (req, res, next) => {
    // Si no hay usuario autenticado, usar rate limiting por IP
    if (!req.user) {
      return generalRateLimit(req, res, next);
    }

    const userId = req.user.id;
    const key = `user:${identifier}:${userId}`;
    const now = Date.now();
    const resetTime = now + windowMs;

    let rateLimitData = rateLimitStore.get(key);

    if (!rateLimitData || now > rateLimitData.resetTime) {
      rateLimitData = {
        count: 0,
        resetTime,
        firstRequest: now,
      };
    }

    rateLimitData.count++;
    rateLimitStore.set(key, rateLimitData);

    const remaining = Math.max(0, maxRequests - rateLimitData.count);
    const resetTimeSeconds = Math.ceil((rateLimitData.resetTime - now) / 1000);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(rateLimitData.resetTime / 1000)
    );

    if (rateLimitData.count > maxRequests) {
      logger.security(
        "User rate limit exceeded",
        {
          userId,
          identifier,
          count: rateLimitData.count,
          maxRequests,
          url: req.originalUrl,
          method: req.method,
        },
        req
      );

      res.setHeader("Retry-After", resetTimeSeconds);

      return res.status(429).json({
        success: false,
        error: {
          code: "USER_RATE_LIMIT_EXCEEDED",
          message: `Demasiadas solicitudes, intenta en ${resetTimeSeconds} segundos`,
          retryAfter: resetTimeSeconds,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};

// Rate limiting para operaciones de préstamos (por usuario)
const loanOperationsRateLimit = createUserRateLimit(
  5, // máximo 5 operaciones
  60 * 1000, // por minuto
  "loans"
);

// Rate limiting para cambio de contraseña (por usuario)
const passwordChangeRateLimit = createUserRateLimit(
  3, // máximo 3 cambios
  60 * 60 * 1000, // por hora
  "password"
);

// Middleware para obtener estadísticas de rate limiting
const getRateLimitStats = (req, res, next) => {
  const stats = {
    totalEntries: rateLimitStore.size,
    activeIPs: new Set(),
    activeUsers: new Set(),
  };

  const now = Date.now();

  for (const [key, data] of rateLimitStore.entries()) {
    if (now <= data.resetTime) {
      if (key.includes("user:")) {
        const userId = key.split(":")[2];
        stats.activeUsers.add(userId);
      } else {
        const ip = key.split(":")[1];
        stats.activeIPs.add(ip);
      }
    }
  }

  stats.activeIPs = stats.activeIPs.size;
  stats.activeUsers = stats.activeUsers.size;

  req.rateLimitStats = stats;
  next();
};

// Middleware para limpiar rate limits de un IP específico (solo admin)
const clearRateLimitForIP = (ip) => {
  const keysToDelete = [];

  for (const key of rateLimitStore.keys()) {
    if (key.includes(ip)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => rateLimitStore.delete(key));

  logger.info(`Cleared rate limits for IP: ${ip}`, {
    clearedKeys: keysToDelete.length,
  });
};

// Middleware para limpiar rate limits de un usuario específico
const clearRateLimitForUser = (userId) => {
  const keysToDelete = [];

  for (const key of rateLimitStore.keys()) {
    if (key.includes(`user:`) && key.includes(`:${userId}`)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => rateLimitStore.delete(key));

  logger.info(`Cleared rate limits for user: ${userId}`, {
    clearedKeys: keysToDelete.length,
  });
};

module.exports = {
  generalRateLimit,
  authRateLimit,
  createResourceRateLimit,
  searchRateLimit,
  reportsRateLimit,
  loanOperationsRateLimit,
  passwordChangeRateLimit,
  createRateLimiter,
  createUserRateLimit,
  getRateLimitStats,
  clearRateLimitForIP,
  clearRateLimitForUser,
  RATE_LIMIT_CONFIGS,
};
