const { FINES_QUERIES, LOANS_QUERIES } = require("../config/queries");
const {
  executeQuery,
  executeQuerySingle,
  executeQueryPaginated,
} = require("../utils/database");
const { validatePagination, validateId } = require("../utils/validation");
const { asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Importar servicios de cálculo de multas
const {
  calculateOverdueFines,
  processFinePayment,
  getFineStatistics,
  validatePaymentAmount,
  generateFineReport,
} = require("../services/fineCalculationService");

// Obtener multas pendientes (solo bibliotecarios/admin)
const getPendingFines = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);
  const { user_id, overdue_only } = req.query;

  try {
    let whereConditions = ["f.is_paid = FALSE"];
    let params = [];
    let paramCount = 0;

    // Filtrar por usuario específico si se proporciona
    if (user_id && !isNaN(parseInt(user_id))) {
      paramCount++;
      whereConditions.push(`f.user_id = $${paramCount}`);
      params.push(parseInt(user_id));
    }

    // Filtrar solo multas de préstamos vencidos
    if (overdue_only === "true") {
      whereConditions.push("l.status = 'overdue'");
    }

    const pendingFinesQuery = `
      SELECT f.id, f.loan_id, f.user_id, f.amount, f.reason, f.created_at,
             u.first_name, u.last_name, u.email, u.phone,
             b.title, b.isbn,
             l.loan_date, l.due_date, l.return_date,
             (CURRENT_DATE - l.due_date) as days_overdue
      FROM fines f
      JOIN users u ON f.user_id = u.id
      JOIN loans l ON f.loan_id = l.id
      JOIN books b ON l.book_id = b.id
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY f.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM fines f
      JOIN loans l ON f.loan_id = l.id
      WHERE ${whereConditions.join(" AND ")}
    `;

    const result = await executeQueryPaginated(
      pendingFinesQuery,
      countQuery,
      params,
      pagination
    );

    if (!result.success) {
      logger.error("Error getting pending fines:", result.error);
      return res.serverError("Error al obtener multas pendientes");
    }

    res.fromDatabasePaginated(
      result,
      "Multas pendientes obtenidas exitosamente"
    );
  } catch (error) {
    logger.error("Get pending fines error:", error.message);
    res.serverError("Error al obtener multas pendientes");
  }
});

// Generar multas por retrasos (job manual - solo admin)
const generateOverdueFines = asyncHandler(async (req, res) => {
  try {
    const result = await calculateOverdueFines();

    if (!result.success) {
      return res.serverError(
        result.error || "Error al generar multas automáticas"
      );
    }

    logger.audit(
      "Manual overdue fines generation",
      {
        fines_generated: result.fines_created,
        loans_processed: result.total_processed,
        executed_by: req.user.id,
        execution_time: new Date().toISOString(),
      },
      req
    );

    res.success(
      {
        fines_generated: result.fines_created,
        loans_processed: result.total_processed,
        total_amount_generated: result.total_amount || 0,
        processed_loans: result.processed_loans || [],
      },
      `Se generaron ${result.fines_created} multas por un total de $${
        result.total_amount || 0
      }`
    );
  } catch (error) {
    logger.error("Generate overdue fines error:", error.message);
    res.serverError("Error al generar multas automáticas");
  }
});

// Procesar pago de multa (solo bibliotecarios/admin)
const processPayment = asyncHandler(async (req, res) => {
  const fineIdValidation = validateId(req.params.id, "ID de multa");

  if (!fineIdValidation.valid) {
    return res.validationError({ fine_id: fineIdValidation.error });
  }

  const {
    payment_method = "efectivo",
    notes,
    partial_payment = false,
  } = req.body;

  try {
    const result = await processFinePayment(fineIdValidation.value, {
      payment_method,
      notes,
      partial_payment,
      processed_by: req.user.id,
    });

    if (!result.success) {
      return res.validationError(
        { payment: [result.error] },
        result.error || "No se puede procesar el pago"
      );
    }

    logger.audit(
      "Fine payment processed",
      {
        fine_id: fineIdValidation.value,
        amount_paid: result.payment.amount,
        payment_method: payment_method,
        user_id: result.payment.user_id,
        processed_by: req.user.id,
      },
      req
    );

    res.success(result.payment, "Pago procesado exitosamente");
  } catch (error) {
    logger.error("Process payment error:", error.message);
    res.serverError("Error al procesar pago");
  }
});

// Obtener multas de usuario específico (solo bibliotecarios/admin)
const getUserFines = asyncHandler(async (req, res) => {
  const userIdValidation = validateId(req.params.user_id, "ID de usuario");
  const pagination = validatePagination(req.query);
  const { status } = req.query;

  if (!userIdValidation.valid) {
    return res.validationError({ user_id: userIdValidation.error });
  }

  try {
    // Verificar que el usuario existe
    const userExists = await executeQuerySingle(
      "SELECT id, first_name, last_name, email FROM users WHERE id = $1",
      [userIdValidation.value],
      "Check user exists for fines query"
    );

    if (!userExists.success || !userExists.data) {
      return res.notFound("Usuario");
    }

    let statusFilter = "";
    let params = [userIdValidation.value];

    if (status && ["paid", "pending"].includes(status)) {
      statusFilter = "AND f.is_paid = $2";
      params.push(status === "paid");
    }

    const userFinesQuery = `
      SELECT f.id, f.amount, f.reason, f.is_paid, f.paid_date, f.created_at,
             l.loan_date, l.due_date, l.return_date,
             b.title, b.isbn,
             CASE 
               WHEN f.is_paid THEN 0
               ELSE (CURRENT_DATE - l.due_date)
             END as current_overdue_days
      FROM fines f
      JOIN loans l ON f.loan_id = l.id
      JOIN books b ON l.book_id = b.id
      WHERE f.user_id = $1 ${statusFilter}
      ORDER BY f.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM fines f
      WHERE f.user_id = $1 ${statusFilter}
    `;

    const result = await executeQueryPaginated(
      userFinesQuery,
      countQuery,
      params,
      pagination
    );

    if (!result.success) {
      logger.error("Error getting user fines:", result.error);
      return res.serverError("Error al obtener multas del usuario");
    }

    // Agregar información del usuario
    const responseData = {
      user: userExists.data,
      fines: result.data,
      pagination: result.pagination,
    };

    res.success(responseData, "Multas del usuario obtenidas exitosamente");
  } catch (error) {
    logger.error("Get user fines error:", error.message);
    res.serverError("Error al obtener multas del usuario");
  }
});

// Obtener mis multas pendientes (usuarios)
const getMyFines = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);

  try {
    const myFinesQuery = `
      SELECT f.id, f.amount, f.reason, f.created_at,
             l.loan_date, l.due_date,
             b.title, b.isbn,
             (CURRENT_DATE - l.due_date) as days_overdue
      FROM fines f
      JOIN loans l ON f.loan_id = l.id
      JOIN books b ON l.book_id = b.id
      WHERE f.user_id = $1 AND f.is_paid = FALSE
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM fines f
      WHERE f.user_id = $1 AND f.is_paid = FALSE
    `;

    const result = await executeQueryPaginated(
      myFinesQuery,
      countQuery,
      [req.user.id],
      pagination
    );

    if (!result.success) {
      logger.error("Error getting user's own fines:", result.error);
      return res.serverError("Error al obtener mis multas");
    }

    // Calcular total de multas pendientes
    const totalQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_amount
      FROM fines
      WHERE user_id = $1 AND is_paid = FALSE
    `;

    const totalResult = await executeQuerySingle(
      totalQuery,
      [req.user.id],
      "Get total fines amount"
    );

    const responseData = {
      fines: result.data,
      pagination: result.pagination,
      summary: {
        total_pending_amount: totalResult.success
          ? parseFloat(totalResult.data.total_amount || 0)
          : 0,
        pending_count: result.pagination.total,
      },
    };

    res.success(responseData, "Mis multas obtenidas exitosamente");
  } catch (error) {
    logger.error("Get my fines error:", error.message);
    res.serverError("Error al obtener mis multas");
  }
});

// Obtener historial de multas del usuario (usuarios)
const getMyFineHistory = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);

  try {
    const historyQuery = `
      SELECT f.id, f.amount, f.reason, f.is_paid, f.paid_date, f.created_at,
             l.loan_date, l.due_date, l.return_date,
             b.title, b.isbn,
             CASE 
               WHEN f.is_paid THEN 'paid'
               ELSE 'pending'
             END as status
      FROM fines f
      JOIN loans l ON f.loan_id = l.id
      JOIN books b ON l.book_id = b.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM fines f
      WHERE f.user_id = $1
    `;

    const result = await executeQueryPaginated(
      historyQuery,
      countQuery,
      [req.user.id],
      pagination
    );

    if (!result.success) {
      logger.error("Error getting user fine history:", result.error);
      return res.serverError("Error al obtener historial de multas");
    }

    res.fromDatabasePaginated(
      result,
      "Historial de multas obtenido exitosamente"
    );
  } catch (error) {
    logger.error("Get fine history error:", error.message);
    res.serverError("Error al obtener historial de multas");
  }
});

// Obtener estadísticas de ingresos por multas (solo admin)
const getRevenueStats = asyncHandler(async (req, res) => {
  const { start_date, end_date, period = "monthly" } = req.query;

  try {
    const statsResult = await getFineStatistics({
      start_date,
      end_date,
      period,
      user_id: req.user.id,
    });

    if (!statsResult.success) {
      return res.serverError("Error al obtener estadísticas de ingresos");
    }

    logger.audit(
      "Revenue statistics accessed",
      {
        period,
        start_date,
        end_date,
        accessed_by: req.user.id,
      },
      req
    );

    res.success(
      statsResult.statistics,
      "Estadísticas de ingresos obtenidas exitosamente"
    );
  } catch (error) {
    logger.error("Get revenue stats error:", error.message);
    res.serverError("Error al obtener estadísticas de ingresos");
  }
});

// Generar reporte mensual de multas (solo admin)
const getMonthlyReport = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const currentDate = new Date();
  const reportYear = year ? parseInt(year) : currentDate.getFullYear();
  const reportMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

  try {
    const reportResult = await generateFineReport({
      year: reportYear,
      month: reportMonth,
      type: "monthly",
    });

    if (!reportResult.success) {
      return res.serverError("Error al generar reporte mensual");
    }

    logger.audit(
      "Monthly fine report generated",
      {
        year: reportYear,
        month: reportMonth,
        generated_by: req.user.id,
      },
      req
    );

    res.success(
      reportResult.report,
      `Reporte mensual de ${reportMonth}/${reportYear} generado exitosamente`
    );
  } catch (error) {
    logger.error("Generate monthly report error:", error.message);
    res.serverError("Error al generar reporte mensual");
  }
});

// Condonar multa (solo admin)
const forgiveFine = asyncHandler(async (req, res) => {
  const fineIdValidation = validateId(req.params.id, "ID de multa");

  if (!fineIdValidation.valid) {
    return res.validationError({ fine_id: fineIdValidation.error });
  }

  const { reason } = req.body;

  if (!reason || reason.trim().length < 10) {
    return res.validationError({
      reason: "Se requiere una razón detallada para condonar la multa",
    });
  }

  try {
    // Verificar que la multa existe y no está pagada
    const fineInfo = await executeQuerySingle(
      `SELECT f.*, u.first_name, u.last_name, l.id as loan_id
      FROM fines f
      JOIN users u ON f.user_id = u.id
      JOIN loans l ON f.loan_id = l.id
      WHERE f.id = $1`,
      [fineIdValidation.value],
      "Get fine info for forgiveness"
    );

    if (!fineInfo.success || !fineInfo.data) {
      return res.notFound("Multa");
    }

    if (fineInfo.data.is_paid) {
      return res.validationError({
        fine: "La multa ya está pagada",
      });
    }

    // Marcar multa como pagada con nota especial
    const forgiveResult = await executeQuerySingle(
      `UPDATE fines 
       SET is_paid = TRUE, paid_date = CURRENT_TIMESTAMP, 
           paid_by = $1, updated_at = CURRENT_TIMESTAMP,
           reason = reason || ' [CONDONADA: ' || $2 || ']'
       WHERE id = $3
       RETURNING id, amount`,
      [req.user.id, reason.trim(), fineIdValidation.value],
      "Forgive fine"
    );

    if (!forgiveResult.success) {
      logger.error("Error forgiving fine:", forgiveResult.error);
      return res.serverError("Error al condonar multa");
    }

    logger.audit(
      "Fine forgiven",
      {
        fine_id: fineIdValidation.value,
        amount_forgiven: fineInfo.data.amount,
        user_id: fineInfo.data.user_id,
        reason: reason.trim(),
        forgiven_by: req.user.id,
      },
      req
    );

    res.success(
      {
        fine_id: fineIdValidation.value,
        amount_forgiven: fineInfo.data.amount,
        user: `${fineInfo.data.first_name} ${fineInfo.data.last_name}`,
        reason: reason.trim(),
      },
      "Multa condonada exitosamente"
    );
  } catch (error) {
    logger.error("Forgive fine error:", error.message);
    res.serverError("Error al condonar multa");
  }
});

module.exports = {
  getPendingFines,
  generateOverdueFines,
  processPayment,
  getUserFines,
  getMyFines,
  getMyFineHistory,
  getRevenueStats,
  getMonthlyReport,
  forgiveFine,
};
