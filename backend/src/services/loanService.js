const {
  LOANS_QUERIES,
  FINES_QUERIES,
  BOOKS_QUERIES,
  USERS_QUERIES,
} = require("../config/queries");
const {
  executeQuery,
  executeQuerySingle,
  executeTransaction,
} = require("../utils/database");
const {
  LOAN_RULES,
  calculateDueDate,
  calculateOverdueDays,
  calculateFineAmount,
  validateLoanEligibility,
  validateBookAvailability,
  validateLoanExtension,
  generateLoanCode,
} = require("../utils/businessRules");
const logger = require("../utils/logger");

// Servicio para verificar elegibilidad de préstamo
const checkLoanEligibility = async (userId, bookId) => {
  try {
    // Obtener estadísticas del usuario
    const userStats = await executeQuerySingle(
      `SELECT 
         u.id, u.first_name, u.last_name, u.email, u.max_loans,
         COALESCE(active_loans.count, 0) as active_loans,
         COALESCE(overdue_loans.count, 0) as overdue_loans,
         COALESCE(unpaid_fines.count, 0) as unpaid_fines_count,
         COALESCE(unpaid_fines.amount, 0) as unpaid_fines_amount
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) as count 
         FROM loans 
         WHERE status = 'active' 
         GROUP BY user_id
       ) active_loans ON u.id = active_loans.user_id
       LEFT JOIN (
         SELECT user_id, COUNT(*) as count 
         FROM loans 
         WHERE status = 'overdue' 
         GROUP BY user_id
       ) overdue_loans ON u.id = overdue_loans.user_id
       LEFT JOIN (
         SELECT user_id, COUNT(*) as count, SUM(amount) as amount
         FROM fines 
         WHERE is_paid = FALSE 
         GROUP BY user_id
       ) unpaid_fines ON u.id = unpaid_fines.user_id
       WHERE u.id = $1 AND u.is_active = true`,
      [userId],
      "Check user loan eligibility"
    );

    if (!userStats.success || !userStats.data) {
      return {
        eligible: false,
        reason: "Usuario no encontrado o inactivo",
        userStats: null,
      };
    }

    // Verificar elegibilidad según reglas de negocio
    const eligibility = validateLoanEligibility(userStats.data);

    // Obtener información del libro
    const bookData = await executeQuerySingle(
      BOOKS_QUERIES.GET_BOOK_BY_ID,
      [bookId],
      "Get book for loan eligibility"
    );

    if (!bookData.success || !bookData.data) {
      return {
        eligible: false,
        reason: "Libro no encontrado",
        userStats: userStats.data,
        bookData: null,
      };
    }

    // Verificar disponibilidad del libro
    const bookAvailability = validateBookAvailability(bookData.data);

    return {
      eligible: eligibility.eligible && bookAvailability.available,
      reasons: [
        ...(eligibility.reasons || []),
        ...(bookAvailability.reasons || []),
      ],
      userStats: userStats.data,
      bookData: bookData.data,
    };
  } catch (error) {
    logger.error("Error checking loan eligibility:", error.message);
    return {
      eligible: false,
      reason: "Error al verificar elegibilidad",
      error: error.message,
    };
  }
};

// Servicio para procesar un nuevo préstamo
const processNewLoan = async (loanData, processedBy) => {
  const {
    user_id,
    book_id,
    loan_days = LOAN_RULES.LOAN_PERIOD_DAYS,
    notes,
  } = loanData;

  try {
    // Verificar elegibilidad
    const eligibility = await checkLoanEligibility(user_id, book_id);

    if (!eligibility.eligible) {
      return {
        success: false,
        error: "Usuario no elegible para préstamo",
        reasons: eligibility.reasons || [eligibility.reason],
      };
    }

    // Calcular fechas
    const loanDate = new Date();
    const dueDate = calculateDueDate(loanDate, loan_days);

    // Preparar transacción para crear préstamo y actualizar disponibilidad
    const queries = [
      {
        query: LOANS_QUERIES.CREATE_LOAN,
        params: [
          user_id,
          book_id,
          dueDate.toISOString().split("T")[0],
          processedBy,
        ],
        context: "Create loan",
      },
    ];

    // Ejecutar transacción
    const transactionResult = await executeTransaction(queries);

    if (!transactionResult.success) {
      logger.error(
        "Transaction failed for loan creation:",
        transactionResult.error
      );
      return {
        success: false,
        error: "Error al procesar préstamo",
        details: transactionResult.error,
      };
    }

    const loanResult = transactionResult.results[0];
    const newLoan = loanResult.data[0];

    // Actualizar disponibilidad del libro (trigger debe hacerlo, pero verificamos)
    const bookUpdate = await executeQuery(
      "UPDATE books SET available_copies = available_copies - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND available_copies > 0 RETURNING available_copies",
      [book_id],
      "Update book availability for loan"
    );

    if (!bookUpdate.success) {
      logger.error("Failed to update book availability:", bookUpdate.error);
      // No retornamos error aquí porque el préstamo ya se creó
    }

    // Log de auditoría
    logger.audit("New loan processed successfully", {
      loan_id: newLoan.id,
      user_id: user_id,
      book_id: book_id,
      book_title: eligibility.bookData?.title,
      user_name: `${eligibility.userStats?.first_name} ${eligibility.userStats?.last_name}`,
      due_date: newLoan.due_date,
      processed_by: processedBy,
    });

    return {
      success: true,
      loan: {
        id: newLoan.id,
        loan_date: newLoan.loan_date,
        due_date: newLoan.due_date,
        user: {
          id: eligibility.userStats.id,
          name: `${eligibility.userStats.first_name} ${eligibility.userStats.last_name}`,
          email: eligibility.userStats.email,
        },
        book: {
          id: eligibility.bookData.id,
          title: eligibility.bookData.title,
          isbn: eligibility.bookData.isbn,
        },
      },
    };
  } catch (error) {
    logger.error("Error processing new loan:", error.message);
    return {
      success: false,
      error: "Error interno al procesar préstamo",
      details: error.message,
    };
  }
};

// Servicio para procesar devolución de préstamo
const processLoanReturn = async (loanId, returnData, processedBy) => {
  const { notes, condition = "good" } = returnData;

  try {
    // Obtener información del préstamo
    const loanInfo = await executeQuerySingle(
      `SELECT l.*, b.title, b.id as book_id, u.first_name, u.last_name, u.email
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [loanId],
      "Get loan info for return"
    );

    if (!loanInfo.success || !loanInfo.data) {
      return {
        success: false,
        error: "Préstamo no encontrado",
      };
    }

    const loan = loanInfo.data;

    // Verificar que el préstamo esté activo
    if (loan.status !== "active" && loan.status !== "overdue") {
      return {
        success: false,
        error: `No se puede devolver un préstamo con estado: ${loan.status}`,
      };
    }

    // Calcular si hay multa por retraso
    const overdueDays = calculateOverdueDays(loan.due_date);
    const fineAmount = calculateFineAmount(overdueDays);

    // Preparar queries para transacción
    const queries = [
      {
        query: LOANS_QUERIES.PROCESS_RETURN,
        params: [loanId, notes],
        context: "Process loan return",
      },
    ];

    // Si hay multa, agregarla a la transacción
    if (fineAmount > 0) {
      queries.push({
        query: FINES_QUERIES.CREATE_FINE,
        params: [
          loanId,
          loan.user_id,
          fineAmount,
          `Devolución tardía - ${overdueDays} días de retraso`,
        ],
        context: "Create overdue fine",
      });
    }

    // Ejecutar transacción
    const transactionResult = await executeTransaction(queries);

    if (!transactionResult.success) {
      logger.error(
        "Transaction failed for loan return:",
        transactionResult.error
      );
      return {
        success: false,
        error: "Error al procesar devolución",
        details: transactionResult.error,
      };
    }

    // Actualizar disponibilidad del libro
    const bookUpdate = await executeQuery(
      "UPDATE books SET available_copies = available_copies + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING available_copies",
      [loan.book_id],
      "Update book availability for return"
    );

    // Log de auditoría
    logger.audit("Loan return processed successfully", {
      loan_id: loanId,
      user_id: loan.user_id,
      book_id: loan.book_id,
      book_title: loan.title,
      user_name: `${loan.first_name} ${loan.last_name}`,
      overdue_days: overdueDays,
      fine_amount: fineAmount,
      condition: condition,
      processed_by: processedBy,
    });

    return {
      success: true,
      return: {
        loan_id: loanId,
        return_date: new Date().toISOString(),
        overdue_days: overdueDays,
        fine_amount: fineAmount,
        condition: condition,
        user: {
          id: loan.user_id,
          name: `${loan.first_name} ${loan.last_name}`,
          email: loan.email,
        },
        book: {
          id: loan.book_id,
          title: loan.title,
        },
      },
    };
  } catch (error) {
    logger.error("Error processing loan return:", error.message);
    return {
      success: false,
      error: "Error interno al procesar devolución",
      details: error.message,
    };
  }
};

// Servicio para extender préstamo
const extendLoan = async (loanId, extensionData, processedBy) => {
  const { extension_days = LOAN_RULES.EXTENSION_DAYS, reason } = extensionData;

  try {
    // Obtener información del préstamo y estadísticas del usuario
    const loanInfo = await executeQuerySingle(
      `SELECT l.*, u.first_name, u.last_name, b.title,
         COALESCE(fines.unpaid_count, 0) as unpaid_fines_count,
         COALESCE(l.extensions, 0) as extensions
       FROM loans l
       JOIN users u ON l.user_id = u.id
       JOIN books b ON l.book_id = b.id
       LEFT JOIN (
         SELECT user_id, COUNT(*) as unpaid_count
         FROM fines
         WHERE is_paid = FALSE
         GROUP BY user_id
       ) fines ON u.id = fines.user_id
       WHERE l.id = $1`,
      [loanId],
      "Get loan info for extension"
    );

    if (!loanInfo.success || !loanInfo.data) {
      return {
        success: false,
        error: "Préstamo no encontrado",
      };
    }

    const loan = loanInfo.data;

    // Validar elegibilidad para extensión
    const extensionEligibility = validateLoanExtension(loan, {
      unpaid_fines_count: loan.unpaid_fines_count,
    });

    if (!extensionEligibility.canExtend) {
      return {
        success: false,
        error: "No se puede extender el préstamo",
        reasons: extensionEligibility.reasons,
      };
    }

    // Calcular nueva fecha de vencimiento
    const currentDueDate = new Date(loan.due_date);
    const newDueDate = new Date(currentDueDate);
    newDueDate.setDate(newDueDate.getDate() + extension_days);

    // Actualizar préstamo con extensión
    const updateResult = await executeQuerySingle(
      `UPDATE loans 
       SET due_date = $1, 
           extensions = COALESCE(extensions, 0) + 1,
           notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL THEN '\n' ELSE '' END || $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, due_date, extensions`,
      [
        newDueDate.toISOString().split("T")[0],
        `Extensión: ${extension_days} días. Razón: ${
          reason || "No especificada"
        }. Procesado por: ${processedBy}`,
        loanId,
      ],
      "Extend loan"
    );

    if (!updateResult.success) {
      logger.error("Failed to extend loan:", updateResult.error);
      return {
        success: false,
        error: "Error al extender préstamo",
        details: updateResult.error,
      };
    }

    // Log de auditoría
    logger.audit("Loan extended successfully", {
      loan_id: loanId,
      user_id: loan.user_id,
      book_id: loan.book_id,
      old_due_date: loan.due_date,
      new_due_date: newDueDate.toISOString().split("T")[0],
      extension_days: extension_days,
      total_extensions: (loan.extensions || 0) + 1,
      reason: reason,
      processed_by: processedBy,
    });

    return {
      success: true,
      extension: {
        loan_id: loanId,
        old_due_date: loan.due_date,
        new_due_date: newDueDate.toISOString().split("T")[0],
        extension_days: extension_days,
        total_extensions: (loan.extensions || 0) + 1,
        user: {
          id: loan.user_id,
          name: `${loan.first_name} ${loan.last_name}`,
        },
        book: {
          id: loan.book_id,
          title: loan.title,
        },
      },
    };
  } catch (error) {
    logger.error("Error extending loan:", error.message);
    return {
      success: false,
      error: "Error interno al extender préstamo",
      details: error.message,
    };
  }
};

// Servicio para generar multas automáticamente por préstamos vencidos
const generateOverdueFines = async () => {
  try {
    const overdueLoans = await executeQuery(
      LOANS_QUERIES.GET_OVERDUE_LOANS,
      [],
      "Get overdue loans for fine generation"
    );

    if (!overdueLoans.success) {
      logger.error("Failed to get overdue loans:", overdueLoans.error);
      return {
        success: false,
        error: "Error al obtener préstamos vencidos",
      };
    }

    let finesCreated = 0;
    const results = [];

    for (const loan of overdueLoans.data) {
      const overdueDays = calculateOverdueDays(loan.due_date);
      const fineAmount = calculateFineAmount(overdueDays);

      if (fineAmount > 0) {
        // Verificar si ya existe multa por este préstamo
        const existingFine = await executeQuerySingle(
          "SELECT id FROM fines WHERE loan_id = $1 AND reason LIKE 'Devolución tardía%'",
          [loan.id],
          "Check existing fine for loan"
        );

        if (!existingFine.success || !existingFine.data) {
          // Crear multa
          const fineResult = await executeQuerySingle(
            FINES_QUERIES.CREATE_FINE,
            [
              loan.id,
              loan.user_id,
              fineAmount,
              `Devolución tardía - ${overdueDays} días de retraso`,
            ],
            "Create automatic overdue fine"
          );

          if (fineResult.success) {
            finesCreated++;
            results.push({
              loan_id: loan.id,
              user_id: loan.user_id,
              amount: fineAmount,
              days_overdue: overdueDays,
            });

            // Actualizar estado del préstamo a 'overdue'
            await executeQuery(
              "UPDATE loans SET status = 'overdue' WHERE id = $1",
              [loan.id],
              "Update loan status to overdue"
            );
          }
        }
      }
    }

    logger.audit("Overdue fines generated", {
      total_overdue_loans: overdueLoans.data.length,
      fines_created: finesCreated,
      results: results,
    });

    return {
      success: true,
      fines_created: finesCreated,
      total_checked: overdueLoans.data.length,
      results: results,
    };
  } catch (error) {
    logger.error("Error generating overdue fines:", error.message);
    return {
      success: false,
      error: "Error interno al generar multas",
      details: error.message,
    };
  }
};

// Servicio para obtener estadísticas de préstamos
const getLoanStatistics = async (filters = {}) => {
  try {
    const { start_date, end_date, user_id } = filters;
    let whereClause = "WHERE 1=1";
    let params = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      whereClause += ` AND l.loan_date >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereClause += ` AND l.loan_date <= $${paramCount}`;
      params.push(end_date);
    }

    if (user_id) {
      paramCount++;
      whereClause += ` AND l.user_id = $${paramCount}`;
      params.push(user_id);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
        COUNT(CASE WHEN l.status = 'returned' THEN 1 END) as returned_loans,
        COUNT(CASE WHEN l.status = 'overdue' THEN 1 END) as overdue_loans,
        COUNT(CASE WHEN l.status = 'lost' THEN 1 END) as lost_loans,
        AVG(CASE WHEN l.return_date IS NOT NULL THEN l.return_date - l.loan_date END) as avg_loan_duration,
        COUNT(DISTINCT l.user_id) as unique_users,
        COUNT(DISTINCT l.book_id) as unique_books
      FROM loans l
      ${whereClause}
    `;

    const stats = await executeQuerySingle(
      statsQuery,
      params,
      "Get loan statistics"
    );

    if (!stats.success) {
      return {
        success: false,
        error: "Error al obtener estadísticas",
        details: stats.error,
      };
    }

    return {
      success: true,
      statistics: stats.data,
    };
  } catch (error) {
    logger.error("Error getting loan statistics:", error.message);
    return {
      success: false,
      error: "Error interno al obtener estadísticas",
      details: error.message,
    };
  }
};

module.exports = {
  checkLoanEligibility,
  processNewLoan,
  processLoanReturn,
  extendLoan,
  generateOverdueFines,
  getLoanStatistics,
};
