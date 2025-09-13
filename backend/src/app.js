const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const logger = require("./utils/logger");
const { testConnection, checkTables } = require("./config/database");
const { attachResponseHelpers } = require("./utils/responseHelper");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { generalRateLimit } = require("./middleware/rateLimiter");

// Importar rutas
const authRoutes = require("./routes/auth");

const app = express();

// Trust proxy (importante para obtener IP real en rate limiting)
app.set("trust proxy", 1);

// Middlewares de seguridad básicos
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configurado
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Rate limiting general
app.use(generalRateLimit);

// Logging de requests (solo para desarrollo)
if (process.env.NODE_ENV === "development") {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

// Parser de JSON con límite de seguridad
app.use(
  express.json({
    limit: "10mb",
    strict: true,
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        logger.security(
          "Invalid JSON payload received",
          {
            contentLength: buf.length,
            contentPreview: buf.toString().substring(0, 100),
          },
          req
        );
        throw new Error("JSON inválido");
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// Headers de seguridad adicionales
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Remover header que expone información del servidor
  res.removeHeader("X-Powered-By");

  next();
});

// Agregar helpers de respuesta al objeto res
app.use(attachResponseHelpers);

// Middleware de logging de requests para auditoría
app.use((req, res, next) => {
  // Log solo requests importantes para auditoría
  if (req.method !== "GET" || req.url.includes("/admin/")) {
    logger.audit(
      "HTTP Request",
      {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      },
      req
    );
  }
  next();
});

// Rutas de la API

// Rutas de autenticación
app.use("/api/auth", authRoutes);

// Rutas del catálogo (requieren autenticación)
app.use("/api/books", booksRoutes);
app.use("/api/authors", authorsRoutes);
app.use("/api/categories", categoriesRoutes);

// Health check básico
app.get("/api/health", async (req, res) => {
  try {
    const dbStatus = await testConnection();
    const tablesExist = await checkTables();

    const checks = {
      database: {
        status: dbStatus ? "healthy" : "unhealthy",
        message: dbStatus ? "Connected" : "Connection failed",
      },
      tables: {
        status: tablesExist ? "healthy" : "warning",
        message: tablesExist ? "All tables exist" : "Some tables missing",
      },
      server: {
        status: "healthy",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      authentication: {
        status: process.env.JWT_SECRET ? "healthy" : "unhealthy",
        message: process.env.JWT_SECRET
          ? "JWT configured"
          : "JWT not configured",
      },
    };

    return res.healthCheck(checks);
  } catch (error) {
    logger.error("Health check failed:", error.message);

    const checks = {
      database: {
        status: "unhealthy",
        message: "Connection error",
      },
      server: {
        status: "healthy",
        uptime: process.uptime(),
      },
      authentication: {
        status: "unhealthy",
        message: "Configuration error",
      },
    };

    return res.healthCheck(checks);
  }
});

// Health check de base de datos específico
app.get("/api/health/db", async (req, res) => {
  try {
    const dbStatus = await testConnection();
    const tablesExist = await checkTables();

    if (dbStatus && tablesExist) {
      return res.success(
        {
          database: "connected",
          tables: "verified",
          connection_time: new Date().toISOString(),
        },
        "Database connection successful"
      );
    } else {
      return res.error("Database connection failed", 503, "DATABASE_ERROR", {
        database_connected: dbStatus,
        tables_verified: tablesExist,
      });
    }
  } catch (error) {
    logger.error("Database health check failed:", error.message);
    return res.error("Database connection error", 503, "DATABASE_ERROR");
  }
});

// Ruta de información del sistema (para debugging en desarrollo)
if (process.env.NODE_ENV === "development") {
  app.get("/api/system/info", (req, res) => {
    const info = {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      jwt_configured: !!process.env.JWT_SECRET,
      timestamp: new Date().toISOString(),
    };

    res.success(info, "System information retrieved");
  });
}

// Ruta para probar validaciones (solo en desarrollo)
if (process.env.NODE_ENV === "development") {
  // Usar una validación simple para test
  const simpleValidation = (data) => {
    const errors = {};
    if (!data.test_field) errors.test_field = "Campo de prueba requerido";
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      data,
    };
  };

  const { validateRequest } = require("./middleware/errorHandler");

  app.post(
    "/api/test/validation",
    validateRequest(simpleValidation),
    (req, res) => {
      res.success(req.body, "Validación exitosa - datos sanitizados");
    }
  );

  // Ruta para probar autenticación (solo en desarrollo)
  const { authenticate } = require("./middleware/auth");
  const { requireAdmin } = require("./middleware/roleAuth");

  app.get("/api/test/auth", authenticate, (req, res) => {
    res.success(
      {
        user: req.user,
        message: "Token válido y usuario autenticado",
      },
      "Prueba de autenticación exitosa"
    );
  });

  app.get("/api/test/admin", authenticate, requireAdmin, (req, res) => {
    res.success(
      {
        user: req.user,
        message: "Acceso administrativo confirmado",
      },
      "Prueba de autorización admin exitosa"
    );
  });
}

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Iniciar servidor
const server = app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);

  // Verificar configuración de seguridad
  const securityChecks = {
    jwt_secret: !!process.env.JWT_SECRET,
    db_password: !!process.env.DB_PASSWORD,
    rate_limiting: true,
    helmet_enabled: true,
    cors_configured: true,
    auth_routes: true,
  };

  logger.info("Security configuration:", securityChecks);

  // Verificar JWT secret
  if (!process.env.JWT_SECRET) {
    logger.error("CRITICAL: JWT_SECRET no está configurado");
    logger.error("El servidor no funcionará correctamente sin JWT_SECRET");
  }

  // Verificar base de datos al inicio
  testConnection()
    .then(async (connected) => {
      if (connected) {
        logger.info("Base de datos conectada exitosamente");

        const tablesOk = await checkTables();
        if (tablesOk) {
          logger.info("Todas las tablas verificadas correctamente");
        } else {
          logger.warn("Algunas tablas del esquema no se encontraron");
        }
      } else {
        logger.error("Error al conectar con la base de datos");
      }
    })
    .catch((error) => {
      logger.error("Error crítico de base de datos:", error.message);
    });
});

// Manejo graceful de cierre
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(() => {
    logger.info("HTTP server closed");

    // Aquí se pueden cerrar otras conexiones (BD, Redis, etc.)
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Manejo de errores no capturados
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

module.exports = app;
