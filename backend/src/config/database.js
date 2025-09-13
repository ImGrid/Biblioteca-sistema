const { Pool } = require("pg");
const logger = require("../utils/logger");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "biblioteca_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,

  // Configuraciones de pool
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,

  // SSL para producción
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,

  // Configuraciones de seguridad
  statement_timeout: 30000,
  query_timeout: 25000,
  application_name: "biblioteca_api",
});

// Event listeners del pool
pool.on("connect", (client) => {
  logger.debug("Nueva conexión establecida con PostgreSQL");
});

pool.on("error", (err, client) => {
  logger.error("Error inesperado en cliente de PostgreSQL:", err);
});

// Probar conexión a la base de datos
const testConnection = async () => {
  try {
    const start = Date.now();
    const client = await pool.connect();

    const result = await client.query(
      "SELECT NOW() as current_time, version() as db_version"
    );
    const duration = Date.now() - start;

    logger.debug(`Conexión a BD exitosa en ${duration}ms`);

    client.release();
    return true;
  } catch (error) {
    logger.error("Error al conectar con PostgreSQL:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    return false;
  }
};

// Ejecutar queries de forma segura
const query = async (text, params = []) => {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === "development" && duration > 1000) {
      logger.warn(`Query lenta (${duration}ms): ${text.substring(0, 100)}...`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    logger.error("Error en query PostgreSQL:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      duration: `${duration}ms`,
      query: text.substring(0, 100) + "...",
    });

    throw error;
  }
};

// Obtener cliente del pool para transacciones
const getClient = async () => {
  try {
    const client = await pool.connect();

    // Agregar método query personalizado al cliente
    const originalQuery = client.query;
    client.query = async (text, params) => {
      const start = Date.now();
      try {
        const result = await originalQuery.call(client, text, params);
        const duration = Date.now() - start;

        if (process.env.NODE_ENV === "development" && duration > 500) {
          logger.debug(`Transaction query: ${duration}ms`);
        }

        return result;
      } catch (error) {
        logger.error("Error en transaction query:", error.message);
        throw error;
      }
    };

    return client;
  } catch (error) {
    logger.error("Error al obtener cliente del pool:", error.message);
    throw error;
  }
};

// Cerrar el pool de conexiones
const closePool = async () => {
  try {
    await pool.end();
    logger.info("Pool de conexiones PostgreSQL cerrado exitosamente");
  } catch (error) {
    logger.error("Error al cerrar pool de conexiones:", error.message);
    throw error;
  }
};

// Verificar si las tablas principales existen
const checkTables = async () => {
  try {
    const result = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

    const tables = result.rows.map((row) => row.table_name);
    const expectedTables = [
      "users",
      "books",
      "authors",
      "categories",
      "loans",
      "fines",
      "audit_logs",
    ];

    logger.info(`Tablas encontradas: ${tables.join(", ")}`);

    const missingTables = expectedTables.filter(
      (table) => !tables.includes(table)
    );
    if (missingTables.length > 0) {
      logger.warn(`Tablas faltantes: ${missingTables.join(", ")}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error al verificar tablas:", error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  testConnection,
  getClient,
  closePool,
  checkTables,
};
