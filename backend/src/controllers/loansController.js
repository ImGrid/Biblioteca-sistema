const { LOANS_QUERIES, FINES_QUERIES } = require("../config/queries");
const {
  executeQuery,
  executeQuerySingle,
  executeQueryPaginated,
} = require("../utils/database");
const { validatePagination } = require("../utils/validation");
const { asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Importar servicios de negocio
const {
  checkLoanEligibility,
  processNewLoan,
  processLoanReturn,
  extendLoan,
  generateOverdueFines,
  getLoanStatistics,
} = require("../services/loanService");

const {
  getUserNotificationSummary,
  processAllNotifications,
  getNotificationStats,
} = require("../services/notificationService");

// Procesar nuevo préstamo (solo bibliotecarios/admin)
const createLoan = asyncHandler(async (req, res) => {
  const { user_id, book_id, loan_days, notes } = req.body;

  try {
    // Procesar préstamo usando servicio de negocio
    const result = await processNewLoan(
      { user_id, book_id, loan_days, notes },
      req.user.id
    );

    if (!result.success) {
      return res.validationError(
        { loan: result.reasons || [result.error] },
        result.error || "No se puede procesar el préstamo"
      );
    }

    logger.audit(
      "Loan created successfully",
      {
        loan_id: result.loan.id,
        user_id: result.loan.user.id,
        book_id: result.loan.book.id,
        processed_by: req.user.id,
      },
      req
    );

    res.created(result.loan, "Préstamo procesado exitosamente");
  } catch (error) {
    logger.error("Create loan error:", error.message);
    res.serverError("Error al procesar préstamo");
  }
});

// Procesar devolución de préstamo (solo bibliotecarios/admin)
const returnLoan = asyncHandler(async (req, res) => {
  const loanId = parseInt(req.params.id);
  const { notes, condition } = req.body;

  if (isNaN(loanId)) {
    return res.validationError({ loan_id: "ID de préstamo inválido" });
  }

  try {
    const result = await processLoanReturn(
      loanId,
      { notes, condition },
      req.user.id
    );

    if (!result.success) {
      return res.validationError(
        { loan: [result.error] },
        result.error || "No se puede procesar la devolución"
      );
    }

    logger.audit(
      "Loan returned successfully",
      {
        loan_id: loanId,
        user_id: result.return.user.id,
        book_id: result.return.book.id,
        overdue_days: result.return.overdue_days,
        fine_amount: result.return.fine_amount,
        processed_by: req.user.id,
      },
      req
    );

    res.success(result.return, "Devolución procesada exitosamente");
  } catch (error) {
    logger.error("Return loan error:", error.message);
    res.serverError("Error al procesar devolución");
  }
});

// Extender préstamo (solo bibliotecarios/admin)
const extendLoanDuration = asyncHandler(async (req, res) => {
  const loanId = parseInt(req.params.id);
  const { extension_days, reason } = req.body;

  if (isNaN(loanId)) {
    return res.validationError({ loan_id: "ID de préstamo inválido" });
  }

  try {
    const result = await extendLoan(
      loanId,
      { extension_days, reason },
      req.user.id
    );

    if (!result.success) {
      return res.validationError(
        { extension: result.reasons || [result.error] },
        result.error || "No se puede extender el préstamo"
      );
    }

    logger.audit(
      "Loan extended successfully",
      {
        loan_id: loanId,
        extension_days: result.extension.extension_days,
        new_due_date: result.extension.new_due_date,
        processed_by: req.user.id,
      },
      req
    );

    res.success(result.extension, "Préstamo extendido exitosamente");
  } catch (error) {
    logger.error("Extend loan error:", error.message);
    res.serverError("Error al extender préstamo");
  }
});

// Obtener préstamos activos (solo bibliotecarios/admin)
const getActiveLoans = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);
  const { user_id, book_id, due_soon } = req.query;

  try {
    let whereConditions = ["l.status = 'active'"];
    let params = [];
    let paramCount = 0;

    // Filtrar por usuario si se especifica
    if (user_id && !isNaN(parseInt(user_id))) {
      paramCount++;
      whereConditions.push(`l.user_id = $${paramCount}`);
      params.push(parseInt(user_id));
    }

    // Filtrar por libro si se especifica
    if (book_id && !isNaN(parseInt(book_id))) {
      paramCount++;
      whereConditions.push(`l.book_id = $${paramCount}`);
      params.push(parseInt(book_id));
    }

    // Filtrar préstamos que vencen pronto
    if (due_soon === "true") {
      whereConditions.push("l.due_date <= CURRENT_DATE + INTERVAL '3 days'");
    }

    const activeLoansQuery = `
      SELECT l.id, l.loan_date, l.due_date, l.notes,
             u.id as user_id, u.first_name, u.last_name, u.email,
             b.id as book_id, b.title, b.isbn,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
             CASE 
               WHEN l.due_date < CURRENT_DATE THEN 'overdue'
               WHEN l.due_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'due_soon'
               ELSE 'active'
             END as loan_status,
             (l.due_date - CURRENT_DATE) as days_until_due
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      WHERE ${whereConditions.join(" AND ")}
      GROUP BY l.id, l.loan_date, l.due_date, l.notes,
               u.id, u.first_name, u.last_name, u.email,
               b.id, b.title, b.isbn
      ORDER BY 
        CASE WHEN l.due_date < CURRENT_DATE THEN 1 ELSE 2 END,
        l.due_date ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM loans l
      WHERE ${whereConditions.join(" AND ")}
    `;

    const result = await executeQueryPaginated(
      activeLoansQuery,
      countQuery,
      params,
      pagination
    );

    if (!result.success) {
      logger.error("Error getting active loans:", result.error);
      return res.serverError("Error al obtener préstamos activos");
    }

    res.fromDatabasePaginated(
      result,
      "Préstamos activos obtenidos exitosamente"
    );
  } catch (error) {
    logger.error("Get active loans error:", error.message);
    res.serverError("Error al obtener préstamos activos");
  }
});

// Obtener préstamos vencidos (solo bibliotecarios/admin)
const getOverdueLoans = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);

  try {
    const overdueLoansQuery = `
      SELECT l.id, l.loan_date, l.due_date, l.notes,
             u.id as user_id, u.first_name, u.last_name, u.email, u.phone,
             b.id as book_id, b.title, b.isbn,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
             (CURRENT_DATE - l.due_date) as days_overdue,
             COALESCE(f.fine_amount, 0) as current_fine
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      LEFT JOIN (
        SELECT loan_id, SUM(amount) as fine_amount
        FROM fines
        WHERE is_paid = false
        GROUP BY loan_id
      ) f ON l.id = f.loan_id
      WHERE l.status IN ('active', 'overdue')
      AND l.due_date < CURRENT_DATE
      GROUP BY l.id, l.loan_date, l.due_date, l.notes,
               u.id, u.first_name, u.last_name, u.email, u.phone,
               b.id, b.title, b.isbn, f.fine_amount
      ORDER BY l.due_date ASC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM loans l
      WHERE l.status IN ('active', 'overdue')
      AND l.due_date < CURRENT_DATE
    `;

    const result = await executeQueryPaginated(
      overdueLoansQuery,
      countQuery,
      [],
      pagination
    );

    if (!result.success) {
      logger.error("Error getting overdue loans:", result.error);
      return res.serverError("Error al obtener préstamos vencidos");
    }

    res.fromDatabasePaginated(
      result,
      "Préstamos vencidos obtenidos exitosamente"
    );
  } catch (error) {
    logger.error("Get overdue loans error:", error.message);
    res.serverError("Error al obtener préstamos vencidos");
  }
});

// Obtener préstamos del usuario autenticado
const getMyLoans = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);
  const { status } = req.query;

  try {
    let statusFilter = "";
    let params = [req.user.id];

    if (status && ["active", "returned", "overdue", "lost"].includes(status)) {
      statusFilter = "AND l.status = $2";
      params.push(status);
    }

    const myLoansQuery = `
      SELECT l.id, l.loan_date, l.due_date, l.return_date, l.status, l.notes,
             b.title, b.isbn, b.location,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
             CASE 
               WHEN l.status = 'active' AND l.due_date < CURRENT_DATE 
               THEN CURRENT_DATE - l.due_date 
               ELSE 0 
             END as days_overdue,
             COALESCE(f.fine_amount, 0) as pending_fines
      FROM loans l
      JOIN books b ON l.book_id = b.id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      LEFT JOIN (
        SELECT loan_id, SUM(amount) as fine_amount
        FROM fines
        WHERE is_paid = false
        GROUP BY loan_id
      ) f ON l.id = f.loan_id
      WHERE l.user_id = $1 ${statusFilter}
      GROUP BY l.id, l.loan_date, l.due_date, l.return_date, l.status, l.notes,
               b.title, b.isbn, b.location, f.fine_amount
      ORDER BY 
        CASE l.status 
          WHEN 'active' THEN 1 
          WHEN 'overdue' THEN 2 
          ELSE 3 
        END,
        l.loan_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM loans l
      WHERE l.user_id = $1 ${statusFilter}
    `;

    const result = await executeQueryPaginated(
      myLoansQuery,
      countQuery,
      params,
      pagination
    );

    if (!result.success) {
      logger.error("Error getting user loans:", result.error);
      return res.serverError("Error al obtener mis préstamos");
    }

    res.fromDatabasePaginated(result, "Mis préstamos obtenidos exitosamente");
  } catch (error) {
    logger.error("Get my loans error:", error.message);
    res.serverError("Error al obtener mis préstamos");
  }
});

// Obtener historial de préstamos del usuario
const getMyLoanHistory = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);

  try {
    const historyQuery = `
      SELECT l.id, l.loan_date, l.due_date, l.return_date, l.status,
             b.title, b.isbn,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
             CASE WHEN l.return_date IS NOT NULL 
               THEN l.return_date - l.loan_date
               ELSE CURRENT_DATE - l.loan_date
             END as loan_duration,
             COALESCE(f.total_fines, 0) as total_fines_paid
      FROM loans l
      JOIN books b ON l.book_id = b.id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      LEFT JOIN (
        SELECT loan_id, SUM(amount) as total_fines
        FROM fines
        WHERE is_paid = true
        GROUP BY loan_id
      ) f ON l.id = f.loan_id
      WHERE l.user_id = $1
      GROUP BY l.id, l.loan_date, l.due_date, l.return_date, l.status,
               b.title, b.isbn, f.total_fines
      ORDER BY l.loan_date DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM loans l
      WHERE l.user_id = $1
    `;

    const result = await executeQueryPaginated(
      historyQuery,
      countQuery,
      [req.user.id],
      pagination
    );

    if (!result.success) {
      logger.error("Error getting user loan history:", result.error);
      return res.serverError("Error al obtener historial");
    }

    res.fromDatabasePaginated(
      result,
      "Historial de préstamos obtenido exitosamente"
    );
  } catch (error) {
    logger.error("Get loan history error:", error.message);
    res.serverError("Error al obtener historial de préstamos");
  }
});

// Obtener préstamos de un usuario específico (solo bibliotecarios/admin)
const getUserLoans = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.user_id);
  const pagination = validatePagination(req.query);

  if (isNaN(userId)) {
    return res.validationError({ user_id: "ID de usuario inválido" });
  }

  try {
    // Verificar que el usuario existe
    const userExists = await executeQuerySingle(
      "SELECT id, first_name, last_name, email FROM users WHERE id = $1",
      [userId],
      "Check user exists for loan query"
    );

    if (!userExists.success || !userExists.data) {
      return res.notFound("Usuario");
    }

    const userLoansQuery = `
      SELECT l.id, l.loan_date, l.due_date, l.return_date, l.status, l.notes,
             b.title, b.isbn,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
             CASE 
               WHEN l.status = 'active' AND l.due_date < CURRENT_DATE 
               THEN CURRENT_DATE - l.due_date 
               ELSE 0 
             END as days_overdue,
             COALESCE(f.fine_amount, 0) as pending_fines
      FROM loans l
      JOIN books b ON l.book_id = b.id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      LEFT JOIN (
        SELECT loan_id, SUM(amount) as fine_amount
        FROM fines
        WHERE is_paid = false
        GROUP BY loan_id
      ) f ON l.id = f.loan_id
      WHERE l.user_id = $1
      GROUP BY l.id, l.loan_date, l.due_date, l.return_date, l.status, l.notes,
               b.title, b.isbn, f.fine_amount
      ORDER BY l.loan_date DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM loans l
      WHERE l.user_id = $1
    `;

    const result = await executeQueryPaginated(
      userLoansQuery,
      countQuery,
      [userId],
      pagination
    );

    if (!result.success) {
      logger.error("Error getting user loans:", result.error);
      return res.serverError("Error al obtener préstamos del usuario");
    }

    // Agregar información del usuario a la respuesta
    const responseData = {
      user: userExists.data,
      loans: result.data,
      pagination: result.pagination,
    };

    res.success(responseData, "Préstamos del usuario obtenidos exitosamente");
  } catch (error) {
    logger.error("Get user loans error:", error.message);
    res.serverError("Error al obtener préstamos del usuario");
  }
});

// Obtener estadísticas de préstamos (solo bibliotecarios/admin)
const getLoansStats = asyncHandler(async (req, res) => {
  const { start_date, end_date, user_id } = req.query;

  try {
    const filters = {};
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (user_id && !isNaN(parseInt(user_id)))
      filters.user_id = parseInt(user_id);

    const statsResult = await getLoanStatistics(filters);

    if (!statsResult.success) {
      return res.serverError("Error al obtener estadísticas");
    }

    res.success(statsResult.statistics, "Estadísticas obtenidas exitosamente");
  } catch (error) {
    logger.error("Get loan stats error:", error.message);
    res.serverError("Error al obtener estadísticas");
  }
});

// Generar multas automáticas por préstamos vencidos (solo admin)
const generateFines = asyncHandler(async (req, res) => {
  try {
    const result = await generateOverdueFines();

    if (!result.success) {
      return res.serverError(result.error || "Error al generar multas");
    }

    logger.audit(
      "Automatic fines generated",
      {
        fines_created: result.fines_created,
        total_checked: result.total_checked,
        generated_by: req.user.id,
      },
      req
    );

    res.success(
      {
        fines_created: result.fines_created,
        total_loans_checked: result.total_checked,
        results: result.results,
      },
      `Se generaron ${result.fines_created} multas automáticamente`
    );
  } catch (error) {
    logger.error("Generate fines error:", error.message);
    res.serverError("Error al generar multas automáticas");
  }
});

// Verificar elegibilidad de préstamo (solo bibliotecarios/admin)
const checkEligibility = asyncHandler(async (req, res) => {
  const { user_id, book_id } = req.body;

  if (!user_id || !book_id) {
    return res.validationError({
      user_id: !user_id ? "ID de usuario requerido" : undefined,
      book_id: !book_id ? "ID de libro requerido" : undefined,
    });
  }

  try {
    const eligibility = await checkLoanEligibility(
      parseInt(user_id),
      parseInt(book_id)
    );

    const response = {
      eligible: eligibility.eligible,
      reasons:
        eligibility.reasons || (eligibility.reason ? [eligibility.reason] : []),
      user_stats: eligibility.userStats,
      book_info: eligibility.bookData,
    };

    res.success(response, "Elegibilidad verificada");
  } catch (error) {
    logger.error("Check eligibility error:", error.message);
    res.serverError("Error al verificar elegibilidad");
  }
});

module.exports = {
  createLoan,
  returnLoan,
  extendLoanDuration,
  getActiveLoans,
  getOverdueLoans,
  getMyLoans,
  getMyLoanHistory,
  getUserLoans,
  getLoansStats,
  generateFines,
  checkEligibility,
};
