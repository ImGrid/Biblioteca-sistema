const { executeQuery, executeQuerySingle } = require("../utils/database");
const {
  NOTIFICATION_RULES,
  createNotificationMessage,
  calculateOverdueDays,
  calculateFineAmount,
} = require("../utils/businessRules");
const logger = require("../utils/logger");

// Estructura base para notificaciones
const createNotification = (type, userId, loanId, data) => {
  return {
    id: Date.now() + Math.random(), // ID temporal
    type,
    user_id: userId,
    loan_id: loanId,
    message: createNotificationMessage(type, data),
    data,
    created_at: new Date().toISOString(),
    sent: false,
  };
};

// Servicio para obtener préstamos próximos a vencer
const getLoansNearDue = async (daysBeforeDue = 3) => {
  try {
    const query = `
      SELECT l.id as loan_id, l.user_id, l.due_date, l.loan_date,
             u.first_name, u.last_name, u.email, u.phone,
             b.title, b.isbn, b.id as book_id,
             (l.due_date - CURRENT_DATE) as days_until_due
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
      WHERE l.status = 'active'
      AND l.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${daysBeforeDue} days'
      AND l.due_date > CURRENT_DATE
      ORDER BY l.due_date ASC
    `;

    const result = await executeQuery(query, [], "Get loans near due");

    if (!result.success) {
      logger.error("Error getting loans near due:", result.error);
      return {
        success: false,
        error: "Error al obtener préstamos próximos a vencer",
        loans: [],
      };
    }

    return {
      success: true,
      loans: result.data,
      count: result.data.length,
    };
  } catch (error) {
    logger.error("Error in getLoansNearDue:", error.message);
    return {
      success: false,
      error: "Error interno al obtener préstamos próximos a vencer",
      loans: [],
    };
  }
};

// Servicio para obtener préstamos vencidos
const getOverdueLoans = async () => {
  try {
    const query = `
      SELECT l.id as loan_id, l.user_id, l.due_date, l.loan_date,
             u.first_name, u.last_name, u.email, u.phone,
             b.title, b.isbn, b.id as book_id,
             (CURRENT_DATE - l.due_date) as days_overdue,
             COALESCE(f.amount, 0) as current_fine_amount
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
      LEFT JOIN (
        SELECT loan_id, SUM(amount) as amount
        FROM fines
        WHERE is_paid = false
        GROUP BY loan_id
      ) f ON l.id = f.loan_id
      WHERE l.status IN ('active', 'overdue')
      AND l.due_date < CURRENT_DATE
      ORDER BY l.due_date ASC
    `;

    const result = await executeQuery(query, [], "Get overdue loans");

    if (!result.success) {
      logger.error("Error getting overdue loans:", result.error);
      return {
        success: false,
        error: "Error al obtener préstamos vencidos",
        loans: [],
      };
    }

    // Calcular multas actualizadas para cada préstamo
    const loansWithUpdatedFines = result.data.map((loan) => {
      const overdueDays = calculateOverdueDays(loan.due_date);
      const calculatedFine = calculateFineAmount(overdueDays);

      return {
        ...loan,
        days_overdue: overdueDays,
        calculated_fine: calculatedFine,
        fine_difference:
          calculatedFine - parseFloat(loan.current_fine_amount || 0),
      };
    });

    return {
      success: true,
      loans: loansWithUpdatedFines,
      count: loansWithUpdatedFines.length,
    };
  } catch (error) {
    logger.error("Error in getOverdueLoans:", error.message);
    return {
      success: false,
      error: "Error interno al obtener préstamos vencidos",
      loans: [],
    };
  }
};

// Servicio para generar notificaciones de recordatorio
const generateReminderNotifications = async () => {
  try {
    const notifications = [];

    // Generar recordatorios para diferentes intervalos
    for (const daysBefore of NOTIFICATION_RULES.REMINDER_DAYS_BEFORE_DUE) {
      const nearDueResult = await getLoansNearDue(daysBefore);

      if (nearDueResult.success) {
        for (const loan of nearDueResult.loans) {
          const notification = createNotification(
            "REMINDER",
            loan.user_id,
            loan.loan_id,
            {
              days: daysBefore,
              title: loan.title,
              due_date: new Date(loan.due_date).toLocaleDateString(),
              user_name: `${loan.first_name} ${loan.last_name}`,
              isbn: loan.isbn,
            }
          );

          notifications.push(notification);
        }
      }
    }

    logger.info(`Generated ${notifications.length} reminder notifications`);

    return {
      success: true,
      notifications,
      count: notifications.length,
    };
  } catch (error) {
    logger.error("Error generating reminder notifications:", error.message);
    return {
      success: false,
      error: "Error al generar notificaciones de recordatorio",
      notifications: [],
    };
  }
};

// Servicio para generar notificaciones de préstamos vencidos
const generateOverdueNotifications = async () => {
  try {
    const overdueResult = await getOverdueLoans();
    const notifications = [];

    if (overdueResult.success) {
      for (const loan of overdueResult.loans) {
        // Solo generar notificación si los días vencidos coinciden con los intervalos configurados
        if (
          NOTIFICATION_RULES.OVERDUE_NOTIFICATION_DAYS.includes(
            loan.days_overdue
          )
        ) {
          const notification = createNotification(
            "OVERDUE",
            loan.user_id,
            loan.loan_id,
            {
              days: loan.days_overdue,
              title: loan.title,
              due_date: new Date(loan.due_date).toLocaleDateString(),
              fine: loan.calculated_fine,
              user_name: `${loan.first_name} ${loan.last_name}`,
              isbn: loan.isbn,
            }
          );

          notifications.push(notification);
        }
      }
    }

    logger.info(`Generated ${notifications.length} overdue notifications`);

    return {
      success: true,
      notifications,
      count: notifications.length,
    };
  } catch (error) {
    logger.error("Error generating overdue notifications:", error.message);
    return {
      success: false,
      error: "Error al generar notificaciones de vencimiento",
      notifications: [],
    };
  }
};

// Servicio para obtener resumen de notificaciones por usuario
const getUserNotificationSummary = async (userId) => {
  try {
    // Obtener préstamos activos del usuario
    const activeLoansQuery = `
      SELECT l.id as loan_id, l.due_date, l.loan_date,
             b.title, b.isbn,
             CASE
               WHEN l.due_date < CURRENT_DATE THEN 'overdue'
               WHEN l.due_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'due_soon'
               ELSE 'active'
             END as loan_status,
             (l.due_date - CURRENT_DATE) as days_until_due,
             (CURRENT_DATE - l.due_date) as days_overdue
      FROM loans l
      JOIN books b ON l.book_id = b.id
      WHERE l.user_id = $1 AND l.status IN ('active', 'overdue')
      ORDER BY l.due_date ASC
    `;

    const loansResult = await executeQuery(
      activeLoansQuery,
      [userId],
      "Get user active loans for notifications"
    );

    if (!loansResult.success) {
      return {
        success: false,
        error: "Error al obtener préstamos del usuario",
      };
    }

    // Obtener multas pendientes
    const finesQuery = `
      SELECT SUM(amount) as total_fines, COUNT(*) as fines_count
      FROM fines
      WHERE user_id = $1 AND is_paid = false
    `;

    const finesResult = await executeQuerySingle(
      finesQuery,
      [userId],
      "Get user unpaid fines"
    );

    const userInfo = await executeQuerySingle(
      "SELECT first_name, last_name, email FROM users WHERE id = $1",
      [userId],
      "Get user info for notifications"
    );

    // Clasificar préstamos por estado
    const loansByStatus = {
      overdue: [],
      due_soon: [],
      active: [],
    };

    for (const loan of loansResult.data) {
      loansByStatus[loan.loan_status].push(loan);
    }

    // Generar resumen
    const summary = {
      user: {
        id: userId,
        name: userInfo.success
          ? `${userInfo.data.first_name} ${userInfo.data.last_name}`
          : "Usuario",
        email: userInfo.success ? userInfo.data.email : null,
      },
      loans: {
        total: loansResult.data.length,
        overdue: loansByStatus.overdue.length,
        due_soon: loansByStatus.due_soon.length,
        active: loansByStatus.active.length,
      },
      fines: {
        count: finesResult.success
          ? parseInt(finesResult.data.fines_count || 0)
          : 0,
        total_amount: finesResult.success
          ? parseFloat(finesResult.data.total_fines || 0)
          : 0,
      },
      loans_detail: loansByStatus,
      notifications_needed:
        loansByStatus.overdue.length > 0 || loansByStatus.due_soon.length > 0,
    };

    return {
      success: true,
      summary,
    };
  } catch (error) {
    logger.error("Error getting user notification summary:", error.message);
    return {
      success: false,
      error: "Error al obtener resumen de notificaciones",
    };
  }
};

// Servicio para simular envío de notificación (en un sistema real, enviaría emails/SMS)
const sendNotification = async (notification) => {
  try {
    // Simular envío exitoso
    // En un sistema real, aquí se integraría con servicios de email (SendGrid, Nodemailer, etc.)

    logger.info("Notification sent", {
      type: notification.type,
      user_id: notification.user_id,
      loan_id: notification.loan_id,
      message: notification.message,
      // No registrar datos sensibles como email completo
    });

    // Simular delay de envío
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      sent_at: new Date().toISOString(),
      notification_id: notification.id,
    };
  } catch (error) {
    logger.error("Error sending notification:", error.message);
    return {
      success: false,
      error: "Error al enviar notificación",
      notification_id: notification.id,
    };
  }
};

// Servicio para procesar todas las notificaciones pendientes
const processAllNotifications = async () => {
  try {
    const results = {
      reminders: { generated: 0, sent: 0, failed: 0 },
      overdue: { generated: 0, sent: 0, failed: 0 },
      total_processed: 0,
      errors: [],
    };

    // Generar y procesar recordatorios
    const reminderResult = await generateReminderNotifications();
    if (reminderResult.success) {
      results.reminders.generated = reminderResult.count;

      for (const notification of reminderResult.notifications) {
        const sendResult = await sendNotification(notification);
        if (sendResult.success) {
          results.reminders.sent++;
        } else {
          results.reminders.failed++;
          results.errors.push({
            type: "reminder",
            notification_id: notification.id,
            error: sendResult.error,
          });
        }
      }
    }

    // Generar y procesar notificaciones de vencimiento
    const overdueResult = await generateOverdueNotifications();
    if (overdueResult.success) {
      results.overdue.generated = overdueResult.count;

      for (const notification of overdueResult.notifications) {
        const sendResult = await sendNotification(notification);
        if (sendResult.success) {
          results.overdue.sent++;
        } else {
          results.overdue.failed++;
          results.errors.push({
            type: "overdue",
            notification_id: notification.id,
            error: sendResult.error,
          });
        }
      }
    }

    results.total_processed = results.reminders.sent + results.overdue.sent;

    logger.audit("Notification processing completed", results);

    return {
      success: true,
      results,
    };
  } catch (error) {
    logger.error("Error processing all notifications:", error.message);
    return {
      success: false,
      error: "Error al procesar notificaciones",
      details: error.message,
    };
  }
};

// Servicio para obtener estadísticas de notificaciones (para dashboard)
const getNotificationStats = async (filters = {}) => {
  try {
    const { days_back = 7 } = filters;

    // En un sistema real, estas estadísticas vendrían de una tabla de notificaciones
    const nearDueResult = await getLoansNearDue(3);
    const overdueResult = await getOverdueLoans();

    const stats = {
      current_status: {
        loans_due_soon: nearDueResult.success ? nearDueResult.count : 0,
        loans_overdue: overdueResult.success ? overdueResult.count : 0,
        users_needing_notifications: 0, // Se calcularía consultando usuarios únicos
      },
      daily_averages: {
        // En un sistema real, se calcularían promedios basados en historial
        avg_reminders_sent: 0,
        avg_overdue_notifications: 0,
      },
      effectiveness: {
        // Métricas de efectividad de las notificaciones
        return_rate_after_reminder: 0, // % de libros devueltos después de recordatorio
        fine_payment_rate: 0, // % de multas pagadas después de notificación
      },
    };

    return {
      success: true,
      stats,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error getting notification stats:", error.message);
    return {
      success: false,
      error: "Error al obtener estadísticas de notificaciones",
    };
  }
};

module.exports = {
  getLoansNearDue,
  getOverdueLoans,
  generateReminderNotifications,
  generateOverdueNotifications,
  getUserNotificationSummary,
  sendNotification,
  processAllNotifications,
  getNotificationStats,
  createNotification,
};
