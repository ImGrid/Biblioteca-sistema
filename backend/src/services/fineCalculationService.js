const {
  FINES_QUERIES,
  LOANS_QUERIES,
  USERS_QUERIES,
} = require("../config/queries");
const {
  executeQuery,
  executeQuerySingle,
  executeTransaction,
} = require("../utils/database");
const {
  LOAN_RULES,
  calculateOverdueDays,
  calculateFineAmount,
} = require("../utils/businessRules");
const logger = require("../utils/logger");

// Servicio para calcular y generar multas automáticas por retrasos
const calculateOverdueFines = async () => {
  try {
    // Obtener préstamos vencidos que no tienen multas generadas
    const overdueLoansQuery = `
      SELECT l.id as loan_id, l.user_id, l.book_id, l.due_date,
             u.first_name, u.last_name, u.email,
             b.title, b.isbn,
             (CURRENT_DATE - l.due_date) as days_overdue
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
      WHERE l.status IN ('active', 'overdue')
      AND l.due_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM fines f 
        WHERE f.loan_id = l.id 
        AND f.reason LIKE 'Devolución tardía%'
        AND DATE(f.created_at) = CURRENT_DATE
      )
      ORDER BY l.due_date ASC
    `;

    const overdueLoans = await executeQuery(
      overdueLoansQuery,
      [],
      "Get overdue loans for fine generation"
    );

    if (!overdueLoans.success) {
      logger.error("Failed to get overdue loans:", overdueLoans.error);
      return {
        success: false,
        error: "Error al obtener préstamos vencidos",
        fines_created: 0,
      };
    }

    let fines_created = 0;
    let total_amount = 0;
    const processed_loans = [];
    const queries = [];

    // Procesar cada préstamo vencido
    for (const loan of overdueLoans.data) {
      const overdueDays = calculateOverdueDays(loan.due_date);
      const fineAmount = calculateFineAmount(overdueDays);

      if (fineAmount > 0) {
        // Agregar query para crear multa
        queries.push({
          query: FINES_QUERIES.CREATE_FINE,
          params: [
            loan.loan_id,
            loan.user_id,
            fineAmount,
            `Devolución tardía - ${overdueDays} días de retraso`,
          ],
          context: `Create fine for loan ${loan.loan_id}`,
        });

        // Agregar query para actualizar estado del préstamo
        queries.push({
          query: "UPDATE loans SET status = 'overdue' WHERE id = $1",
          params: [loan.loan_id],
          context: `Update loan ${loan.loan_id} to overdue`,
        });

        total_amount += fineAmount;
        processed_loans.push({
          loan_id: loan.loan_id,
          user: `${loan.first_name} ${loan.last_name}`,
          book: loan.title,
          days_overdue: overdueDays,
          fine_amount: fineAmount,
        });
      }
    }

    // Ejecutar todas las transacciones
    if (queries.length > 0) {
      const transactionResult = await executeTransaction(queries);

      if (transactionResult.success) {
        fines_created = queries.length / 2; // Dividido entre 2 porque cada multa tiene 2 queries
        logger.info(`Generated ${fines_created} overdue fines`, {
          total_amount,
          processed_loans: processed_loans.length,
        });
      } else {
        logger.error(
          "Transaction failed for fine generation:",
          transactionResult.error
        );
        return {
          success: false,
          error: "Error al generar multas en la base de datos",
          fines_created: 0,
        };
      }
    }

    return {
      success: true,
      fines_created,
      total_processed: overdueLoans.data.length,
      total_amount,
      processed_loans,
    };
  } catch (error) {
    logger.error("Error in calculateOverdueFines:", error.message);
    return {
      success: false,
      error: "Error interno al calcular multas",
      fines_created: 0,
    };
  }
};

// Servicio para procesar pago de multa
const processFinePayment = async (fineId, paymentData) => {
  const {
    payment_method = "efectivo",
    notes,
    partial_payment = false,
    processed_by,
  } = paymentData;

  try {
    // Obtener información de la multa
    const fineInfo = await executeQuerySingle(
      `SELECT f.*, u.first_name, u.last_name, u.email, l.id as loan_id, b.title
       FROM fines f
       JOIN users u ON f.user_id = u.id
       JOIN loans l ON f.loan_id = l.id
       JOIN books b ON l.book_id = b.id
       WHERE f.id = $1`,
      [fineId],
      "Get fine info for payment"
    );

    if (!fineInfo.success || !fineInfo.data) {
      return {
        success: false,
        error: "Multa no encontrada",
      };
    }

    const fine = fineInfo.data;

    // Verificar que la multa no esté pagada
    if (fine.is_paid) {
      return {
        success: false,
        error: "La multa ya está pagada",
      };
    }

    // Validar método de pago
    const validPaymentMethods = [
      "efectivo",
      "tarjeta",
      "transferencia",
      "cheque",
    ];
    if (!validPaymentMethods.includes(payment_method)) {
      return {
        success: false,
        error: "Método de pago inválido",
      };
    }

    // Procesar pago completo (por ahora no soportamos pagos parciales)
    if (partial_payment) {
      return {
        success: false,
        error: "Pagos parciales no están implementados en esta versión",
      };
    }

    // Procesar pago en transacción
    const paymentQueries = [
      {
        query: FINES_QUERIES.PROCESS_FINE_PAYMENT,
        params: [fineId, processed_by],
        context: "Process fine payment",
      },
    ];

    const transactionResult = await executeTransaction(paymentQueries);

    if (!transactionResult.success) {
      logger.error("Payment transaction failed:", transactionResult.error);
      return {
        success: false,
        error: "Error al procesar el pago",
      };
    }

    // Log de auditoría
    logger.audit("Fine payment processed successfully", {
      fine_id: fineId,
      user_id: fine.user_id,
      amount: fine.amount,
      payment_method,
      processed_by,
    });

    return {
      success: true,
      payment: {
        fine_id: fineId,
        amount: fine.amount,
        payment_method,
        processed_at: new Date().toISOString(),
        user_id: fine.user_id,
        user_name: `${fine.first_name} ${fine.last_name}`,
        book_title: fine.title,
        notes: notes || null,
      },
    };
  } catch (error) {
    logger.error("Error in processFinePayment:", error.message);
    return {
      success: false,
      error: "Error interno al procesar pago",
      details: error.message,
    };
  }
};

// Servicio para obtener estadísticas financieras de multas
const getFineStatistics = async (filters = {}) => {
  try {
    const { start_date, end_date, period = "monthly", user_id } = filters;
    let dateFilter = "";
    let params = [];
    let paramIndex = 0;

    // Construir filtro de fechas
    if (start_date) {
      paramIndex++;
      dateFilter += ` AND f.created_at >= $${paramIndex}`;
      params.push(start_date);
    }

    if (end_date) {
      paramIndex++;
      dateFilter += ` AND f.created_at <= $${paramIndex}`;
      params.push(end_date);
    }

    if (user_id) {
      paramIndex++;
      dateFilter += ` AND f.user_id = $${paramIndex}`;
      params.push(user_id);
    }

    // Estadísticas generales
    const generalStatsQuery = `
      SELECT 
        COUNT(*) as total_fines,
        COUNT(CASE WHEN f.is_paid = TRUE THEN 1 END) as paid_fines,
        COUNT(CASE WHEN f.is_paid = FALSE THEN 1 END) as pending_fines,
        COALESCE(SUM(f.amount), 0) as total_amount_generated,
        COALESCE(SUM(CASE WHEN f.is_paid = TRUE THEN f.amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN f.is_paid = FALSE THEN f.amount ELSE 0 END), 0) as pending_revenue,
        COALESCE(AVG(f.amount), 0) as average_fine_amount
      FROM fines f
      WHERE 1=1 ${dateFilter}
    `;

    const generalStats = await executeQuerySingle(
      generalStatsQuery,
      params,
      "Get general fine statistics"
    );

    if (!generalStats.success) {
      return {
        success: false,
        error: "Error al obtener estadísticas generales",
      };
    }

    // Estadísticas por período (mensual/semanal)
    let periodGroupBy = "";
    let periodSelect = "";

    if (period === "monthly") {
      periodSelect = "TO_CHAR(f.created_at, 'YYYY-MM') as period";
      periodGroupBy = "TO_CHAR(f.created_at, 'YYYY-MM')";
    } else if (period === "weekly") {
      periodSelect = "TO_CHAR(f.created_at, 'YYYY-\"W\"WW') as period";
      periodGroupBy = "TO_CHAR(f.created_at, 'YYYY-\"W\"WW')";
    } else {
      periodSelect = "DATE(f.created_at) as period";
      periodGroupBy = "DATE(f.created_at)";
    }

    const periodStatsQuery = `
      SELECT 
        ${periodSelect},
        COUNT(*) as fines_count,
        SUM(CASE WHEN f.is_paid = TRUE THEN f.amount ELSE 0 END) as revenue,
        COUNT(CASE WHEN f.is_paid = TRUE THEN 1 END) as paid_count,
        COUNT(CASE WHEN f.is_paid = FALSE THEN 1 END) as pending_count
      FROM fines f
      WHERE 1=1 ${dateFilter}
      GROUP BY ${periodGroupBy}
      ORDER BY period DESC
      LIMIT 12
    `;

    const periodStats = await executeQuery(
      periodStatsQuery,
      params,
      "Get period fine statistics"
    );

    // Top usuarios con más multas
    const topUsersQuery = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email,
        COUNT(f.id) as total_fines,
        SUM(f.amount) as total_amount,
        COUNT(CASE WHEN f.is_paid = FALSE THEN 1 END) as pending_fines
      FROM fines f
      JOIN users u ON f.user_id = u.id
      WHERE 1=1 ${dateFilter}
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    const topUsers = await executeQuery(
      topUsersQuery,
      params,
      "Get top users with fines"
    );

    return {
      success: true,
      statistics: {
        general: generalStats.data,
        by_period: periodStats.success ? periodStats.data : [],
        top_users: topUsers.success ? topUsers.data : [],
        generated_at: new Date().toISOString(),
        period,
        filters: { start_date, end_date, user_id },
      },
    };
  } catch (error) {
    logger.error("Error in getFineStatistics:", error.message);
    return {
      success: false,
      error: "Error interno al obtener estadísticas",
      details: error.message,
    };
  }
};

// Servicio para generar reporte mensual de multas
const generateFineReport = async (reportParams) => {
  try {
    const { year, month, type = "monthly" } = reportParams;

    // Construir rango de fechas para el reporte
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Último día del mes

    const reportQuery = `
      WITH daily_stats AS (
        SELECT 
          DATE(f.created_at) as report_date,
          COUNT(*) as fines_generated,
          SUM(f.amount) as amount_generated,
          COUNT(CASE WHEN f.is_paid = TRUE AND DATE(f.paid_date) = DATE(f.created_at) THEN 1 END) as same_day_payments,
          SUM(CASE WHEN f.is_paid = TRUE AND DATE(f.paid_date) = DATE(f.created_at) THEN f.amount ELSE 0 END) as same_day_revenue
        FROM fines f
        WHERE f.created_at >= $1 AND f.created_at < $2
        GROUP BY DATE(f.created_at)
      ),
      monthly_summary AS (
        SELECT 
          COUNT(*) as total_fines,
          SUM(f.amount) as total_generated,
          COUNT(CASE WHEN f.is_paid = TRUE THEN 1 END) as paid_fines,
          SUM(CASE WHEN f.is_paid = TRUE THEN f.amount ELSE 0 END) as total_revenue,
          COUNT(DISTINCT f.user_id) as affected_users,
          AVG(f.amount) as avg_fine_amount
        FROM fines f
        WHERE f.created_at >= $1 AND f.created_at < $2
      )
      SELECT 
        json_build_object(
          'period', $3 || '/' || $4,
          'daily_breakdown', (SELECT json_agg(daily_stats) FROM daily_stats),
          'summary', (SELECT row_to_json(monthly_summary) FROM monthly_summary)
        ) as report_data
    `;

    const reportResult = await executeQuerySingle(
      reportQuery,
      [startDate.toISOString(), endDate.toISOString(), month, year],
      "Generate monthly fine report"
    );

    if (!reportResult.success) {
      return {
        success: false,
        error: "Error al generar reporte mensual",
      };
    }

    return {
      success: true,
      report: {
        ...reportResult.data.report_data,
        generated_at: new Date().toISOString(),
        report_type: type,
      },
    };
  } catch (error) {
    logger.error("Error in generateFineReport:", error.message);
    return {
      success: false,
      error: "Error interno al generar reporte",
      details: error.message,
    };
  }
};

// Servicio para validar monto de pago
const validatePaymentAmount = (
  fineAmount,
  paidAmount,
  allowPartial = false
) => {
  const errors = [];

  if (!paidAmount || paidAmount <= 0) {
    errors.push("El monto de pago debe ser mayor a cero");
  }

  if (!allowPartial && paidAmount !== fineAmount) {
    errors.push(
      "El monto de pago debe coincidir exactamente con el monto de la multa"
    );
  }

  if (allowPartial && paidAmount > fineAmount) {
    errors.push("El monto de pago no puede ser mayor al monto de la multa");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Servicio para obtener resumen de multas de usuario
const getUserFineSummary = async (userId) => {
  try {
    const summaryQuery = `
      SELECT 
        COUNT(CASE WHEN is_paid = FALSE THEN 1 END) as pending_fines_count,
        COALESCE(SUM(CASE WHEN is_paid = FALSE THEN amount ELSE 0 END), 0) as pending_amount,
        COUNT(CASE WHEN is_paid = TRUE THEN 1 END) as paid_fines_count,
        COALESCE(SUM(CASE WHEN is_paid = TRUE THEN amount ELSE 0 END), 0) as total_paid,
        COUNT(*) as total_fines,
        COALESCE(SUM(amount), 0) as total_amount_ever,
        MIN(created_at) as first_fine_date,
        MAX(created_at) as last_fine_date
      FROM fines
      WHERE user_id = $1
    `;

    const result = await executeQuerySingle(
      summaryQuery,
      [userId],
      "Get user fine summary"
    );

    if (!result.success) {
      return {
        success: false,
        error: "Error al obtener resumen de multas del usuario",
      };
    }

    return {
      success: true,
      summary: result.data,
    };
  } catch (error) {
    logger.error("Error in getUserFineSummary:", error.message);
    return {
      success: false,
      error: "Error interno al obtener resumen",
      details: error.message,
    };
  }
};

module.exports = {
  calculateOverdueFines,
  processFinePayment,
  getFineStatistics,
  generateFineReport,
  validatePaymentAmount,
  getUserFineSummary,
};
