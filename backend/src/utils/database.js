const { pool, query: baseQuery, getClient } = require("../config/database");
const logger = require("./logger");

// Ejecutar query con manejo de errores y logging
const executeQuery = async (queryText, params = [], context = "") => {
  try {
    const result = await baseQuery(queryText, params);
    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      query: context,
    };
  } catch (error) {
    logger.error(`Database query failed - ${context}:`, {
      error: error.message,
      code: error.code,
      detail: error.detail,
      query: queryText.substring(0, 100) + "...",
    });

    return {
      success: false,
      error: error.message,
      code: error.code,
      query: context,
    };
  }
};

// Ejecutar query que espera un solo resultado
const executeQuerySingle = async (queryText, params = [], context = "") => {
  const result = await executeQuery(queryText, params, context);

  if (!result.success) {
    return result;
  }

  return {
    ...result,
    data: result.data[0] || null,
  };
};

// Ejecutar query con paginación
const executeQueryPaginated = async (
  queryText,
  countQuery,
  params = [],
  paginationParams = {}
) => {
  const { page = 1, limit = 10 } = paginationParams;
  const offset = (page - 1) * limit;

  try {
    // Ejecutar query principal con límite y offset
    const queryParams = [...params, limit, offset];
    const dataResult = await baseQuery(queryText, queryParams);

    // Ejecutar query de conteo
    const countResult = await baseQuery(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    return {
      success: true,
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error("Paginated query failed:", {
      error: error.message,
      code: error.code,
      page,
      limit,
    });

    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
};

// Ejecutar múltiples queries en transacción
const executeTransaction = async (queries) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const results = [];
    for (const queryInfo of queries) {
      const { query: queryText, params = [], context = "" } = queryInfo;
      const result = await client.query(queryText, params);
      results.push({
        success: true,
        data: result.rows,
        rowCount: result.rowCount,
        context,
      });
    }

    await client.query("COMMIT");

    logger.info(
      `Transaction completed successfully with ${queries.length} queries`
    );

    return {
      success: true,
      results,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    logger.error("Transaction failed:", {
      error: error.message,
      code: error.code,
      detail: error.detail,
      queriesCount: queries.length,
    });

    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  } finally {
    client.release();
  }
};

// Verificar si un registro existe
const recordExists = async (table, field, value) => {
  const queryText = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${field} = $1) as exists`;
  const result = await executeQuerySingle(
    queryText,
    [value],
    `Check if ${field} exists in ${table}`
  );

  if (!result.success) {
    return false;
  }

  return result.data?.exists || false;
};

// Obtener el siguiente ID disponible (para códigos únicos)
const getNextId = async (table, field = "id") => {
  const queryText = `SELECT COALESCE(MAX(${field}), 0) + 1 as next_id FROM ${table}`;
  const result = await executeQuerySingle(
    queryText,
    [],
    `Get next ID for ${table}`
  );

  if (!result.success) {
    return null;
  }

  return result.data?.next_id || 1;
};

// Obtener estadísticas rápidas de una tabla
const getTableStats = async (table, conditions = "") => {
  const whereClause = conditions ? `WHERE ${conditions}` : "";
  const queryText = `
        SELECT 
            COUNT(*) as total_count,
            MIN(created_at) as first_created,
            MAX(created_at) as last_created
        FROM ${table} ${whereClause}
    `;

  const result = await executeQuerySingle(
    queryText,
    [],
    `Get stats for ${table}`
  );
  return result;
};

// Validar integridad referencial antes de operaciones
const validateForeignKey = async (
  table,
  field,
  value,
  referenceTable = null
) => {
  if (!value) return { valid: true };

  let queryText;
  let context;

  if (referenceTable) {
    queryText = `SELECT EXISTS(SELECT 1 FROM ${referenceTable} WHERE id = $1) as exists`;
    context = `Validate FK ${table}.${field} -> ${referenceTable}.id`;
  } else {
    // Auto-detectar tabla de referencia basada en convención
    const refTable = field.replace("_id", "s"); // user_id -> users
    queryText = `SELECT EXISTS(SELECT 1 FROM ${refTable} WHERE id = $1) as exists`;
    context = `Validate FK ${table}.${field} -> ${refTable}.id`;
  }

  const result = await executeQuerySingle(queryText, [value], context);

  if (!result.success) {
    return { valid: false, error: result.error };
  }

  return { valid: result.data?.exists || false };
};

// Limpiar y sanitizar parámetros de entrada
const sanitizeParams = (params) => {
  if (!Array.isArray(params)) {
    return [];
  }

  return params.map((param) => {
    if (typeof param === "string") {
      // Remover caracteres potencialmente peligrosos
      return param.trim().replace(/[\x00-\x1F\x7F]/g, "");
    }
    return param;
  });
};

// Helper para construir queries WHERE dinámicas de forma segura
const buildWhereClause = (conditions) => {
  if (!conditions || Object.keys(conditions).length === 0) {
    return { where: "", params: [] };
  }

  const whereParts = [];
  const params = [];
  let paramIndex = 1;

  Object.entries(conditions).forEach(([field, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`).join(", ");
        whereParts.push(`${field} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === "object" && value.operator) {
        whereParts.push(`${field} ${value.operator} $${paramIndex++}`);
        params.push(value.value);
      } else {
        whereParts.push(`${field} = $${paramIndex++}`);
        params.push(value);
      }
    }
  });

  return {
    where: whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "",
    params: sanitizeParams(params),
  };
};

// Helpers específicos para operaciones comunes
const insertRecord = async (table, data, returningFields = "id") => {
  const fields = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

  const queryText = `
        INSERT INTO ${table} (${fields.join(", ")})
        VALUES (${placeholders})
        RETURNING ${returningFields}
    `;

  return await executeQuerySingle(
    queryText,
    sanitizeParams(values),
    `Insert into ${table}`
  );
};

const updateRecord = async (table, data, conditions) => {
  const updateFields = Object.keys(data);
  const updateValues = Object.values(data);

  const setClause = updateFields
    .map((field, index) => `${field} = $${index + 1}`)
    .join(", ");
  const { where, params: whereParams } = buildWhereClause(conditions);

  const allParams = [...sanitizeParams(updateValues), ...whereParams];
  const whereClauseAdjusted = where.replace(
    /\$(\d+)/g,
    (match, num) => `$${parseInt(num) + updateValues.length}`
  );

  const queryText = `
        UPDATE ${table} 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        ${whereClauseAdjusted}
        RETURNING *
    `;

  return await executeQuerySingle(queryText, allParams, `Update ${table}`);
};

const deleteRecord = async (table, conditions, soft = true) => {
  const { where, params } = buildWhereClause(conditions);

  let queryText;
  if (soft && table !== "audit_logs") {
    queryText = `
            UPDATE ${table} 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            ${where}
            RETURNING id
        `;
  } else {
    queryText = `DELETE FROM ${table} ${where} RETURNING id`;
  }

  return await executeQuerySingle(queryText, params, `Delete from ${table}`);
};

module.exports = {
  executeQuery,
  executeQuerySingle,
  executeQueryPaginated,
  executeTransaction,
  recordExists,
  getNextId,
  getTableStats,
  validateForeignKey,
  sanitizeParams,
  buildWhereClause,
  insertRecord,
  updateRecord,
  deleteRecord,
};
