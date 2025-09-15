const { executeQuery, executeQuerySingle } = require("../utils/database");
const { validatePagination } = require("../utils/validation");
const { asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Dashboard para usuarios normales - solo sus datos
const getUserDashboard = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información del usuario
    const userInfo = await executeQuerySingle(
      `SELECT first_name, last_name, email, created_at, last_login, max_loans
       FROM users WHERE id = $1`,
      [userId],
      "Get user info for dashboard"
    );

    // Obtener préstamos activos del usuario
    const activeLoans = await executeQuery(
      `SELECT l.id, l.loan_date, l.due_date, b.title, b.isbn,
              STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
              CASE 
                WHEN l.due_date < CURRENT_DATE THEN 'overdue'
                WHEN l.due_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'due_soon'
                ELSE 'active'
              END as status,
              (l.due_date - CURRENT_DATE) as days_until_due
       FROM loans l
       JOIN books b ON l.book_id = b.id
       LEFT JOIN book_authors ba ON b.id = ba.book_id
       LEFT JOIN authors a ON ba.author_id = a.id
       WHERE l.user_id = $1 AND l.status IN ('active', 'overdue')
       GROUP BY l.id, l.loan_date, l.due_date, b.title, b.isbn
       ORDER BY l.due_date ASC`,
      [userId],
      "Get user active loans"
    );

    // Obtener multas pendientes
    const unpaidFines = await executeQuerySingle(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
       FROM fines 
       WHERE user_id = $1 AND is_paid = false`,
      [userId],
      "Get user unpaid fines"
    );

    // Estadísticas de historial
    const loanHistory = await executeQuerySingle(
      `SELECT 
         COUNT(*) as total_loans,
         COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as returned_loans,
         AVG(CASE WHEN return_date IS NOT NULL THEN return_date - loan_date END) as avg_loan_duration
       FROM loans 
       WHERE user_id = $1`,
      [userId],
      "Get user loan history stats"
    );

    // Libros más leídos por el usuario
    const favoriteBooks = await executeQuery(
      `SELECT b.title, b.isbn, COUNT(*) as times_borrowed,
              STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
       FROM loans l
       JOIN books b ON l.book_id = b.id
       LEFT JOIN book_authors ba ON b.id = ba.book_id
       LEFT JOIN authors a ON ba.author_id = a.id
       WHERE l.user_id = $1
       GROUP BY b.id, b.title, b.isbn
       ORDER BY times_borrowed DESC, b.title
       LIMIT 5`,
      [userId],
      "Get user favorite books"
    );

    const dashboard = {
      user: userInfo.success ? userInfo.data : null,
      current_loans: {
        active: activeLoans.success ? activeLoans.data : [],
        count: activeLoans.success ? activeLoans.data.length : 0,
        overdue_count: activeLoans.success
          ? activeLoans.data.filter((loan) => loan.status === "overdue").length
          : 0,
        due_soon_count: activeLoans.success
          ? activeLoans.data.filter((loan) => loan.status === "due_soon").length
          : 0,
      },
      fines: {
        pending_count: unpaidFines.success
          ? parseInt(unpaidFines.data.count)
          : 0,
        total_amount: unpaidFines.success
          ? parseFloat(unpaidFines.data.total_amount)
          : 0,
      },
      statistics: {
        total_loans: loanHistory.success
          ? parseInt(loanHistory.data.total_loans)
          : 0,
        returned_loans: loanHistory.success
          ? parseInt(loanHistory.data.returned_loans)
          : 0,
        avg_loan_days: loanHistory.success
          ? Math.round(parseFloat(loanHistory.data.avg_loan_duration) || 0)
          : 0,
      },
      favorite_books: favoriteBooks.success ? favoriteBooks.data : [],
      recommendations: {
        can_borrow_more: activeLoans.success
          ? activeLoans.data.length < (userInfo.data?.max_loans || 3)
          : true,
        has_overdue: activeLoans.success
          ? activeLoans.data.some((loan) => loan.status === "overdue")
          : false,
      },
    };

    res.success(dashboard, "Dashboard de usuario obtenido exitosamente");
  } catch (error) {
    logger.error("Error getting user dashboard:", error.message);
    res.serverError("Error al obtener dashboard");
  }
});

// Dashboard para bibliotecarios - información operativa
const getLibrarianDashboard = asyncHandler(async (req, res) => {
  try {
    // Estadísticas de hoy
    const todayStats = await executeQuerySingle(
      `SELECT 
         COUNT(CASE WHEN l.loan_date = CURRENT_DATE THEN 1 END) as loans_today,
         COUNT(CASE WHEN l.return_date = CURRENT_DATE THEN 1 END) as returns_today,
         COUNT(CASE WHEN f.paid_date::date = CURRENT_DATE THEN 1 END) as payments_today
       FROM loans l
       FULL OUTER JOIN fines f ON l.id = f.loan_id`,
      [],
      "Get today stats for librarian"
    );

    // Préstamos que vencen hoy
    const dueToday = await executeQuery(
      `SELECT l.id, l.due_date, u.first_name, u.last_name, u.email, u.phone,
              b.title, b.isbn
       FROM loans l
       JOIN users u ON l.user_id = u.id
       JOIN books b ON l.book_id = b.id
       WHERE l.status = 'active' AND l.due_date = CURRENT_DATE
       ORDER BY u.last_name, u.first_name`,
      [],
      "Get loans due today"
    );

    // Préstamos vencidos
    const overdueLoans = await executeQuery(
      `SELECT l.id, l.due_date, (CURRENT_DATE - l.due_date) as days_overdue,
              u.first_name, u.last_name, u.email, u.phone,
              b.title, b.isbn,
              COALESCE(f.amount, 0) as fine_amount
       FROM loans l
       JOIN users u ON l.user_id = u.id
       JOIN books b ON l.book_id = b.id
       LEFT JOIN (
         SELECT loan_id, SUM(amount) as amount
         FROM fines 
         WHERE is_paid = false 
         GROUP BY loan_id
       ) f ON l.id = f.loan_id
       WHERE l.status IN ('active', 'overdue') AND l.due_date < CURRENT_DATE
       ORDER BY l.due_date ASC
       LIMIT 10`,
      [],
      "Get overdue loans for librarian"
    );

    // Multas pendientes de procesar
    const pendingFines = await executeQuery(
      `SELECT f.id, f.amount, f.reason, f.created_at,
              u.first_name, u.last_name, u.email,
              b.title
       FROM fines f
       JOIN users u ON f.user_id = u.id
       JOIN loans l ON f.loan_id = l.id
       JOIN books b ON l.book_id = b.id
       WHERE f.is_paid = false
       ORDER BY f.created_at DESC
       LIMIT 10`,
      [],
      "Get pending fines for librarian"
    );

    // Estadísticas semanales
    const weeklyStats = await executeQuerySingle(
      `SELECT 
         COUNT(CASE WHEN l.loan_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as loans_this_week,
         COUNT(CASE WHEN l.return_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as returns_this_week,
         COUNT(CASE WHEN f.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as fines_this_week,
         COALESCE(SUM(CASE WHEN f.paid_date >= CURRENT_DATE - INTERVAL '7 days' THEN f.amount END), 0) as revenue_this_week
       FROM loans l
       FULL OUTER JOIN fines f ON l.id = f.loan_id`,
      [],
      "Get weekly stats for librarian"
    );

    // Libros más prestados esta semana
    const popularBooks = await executeQuery(
      `SELECT b.title, b.isbn, COUNT(*) as loan_count,
              STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
       FROM loans l
       JOIN books b ON l.book_id = b.id
       LEFT JOIN book_authors ba ON b.id = ba.book_id
       LEFT JOIN authors a ON ba.author_id = a.id
       WHERE l.loan_date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY b.id, b.title, b.isbn
       ORDER BY loan_count DESC
       LIMIT 5`,
      [],
      "Get popular books this week"
    );

    const dashboard = {
      today: {
        loans: todayStats.success ? parseInt(todayStats.data.loans_today) : 0,
        returns: todayStats.success
          ? parseInt(todayStats.data.returns_today)
          : 0,
        payments: todayStats.success
          ? parseInt(todayStats.data.payments_today)
          : 0,
        due_today: dueToday.success ? dueToday.data : [],
      },
      urgent_tasks: {
        overdue_loans: overdueLoans.success ? overdueLoans.data : [],
        pending_fines: pendingFines.success ? pendingFines.data : [],
        overdue_count: overdueLoans.success ? overdueLoans.data.length : 0,
        pending_fines_count: pendingFines.success
          ? pendingFines.data.length
          : 0,
      },
      weekly_summary: {
        loans: weeklyStats.success
          ? parseInt(weeklyStats.data.loans_this_week)
          : 0,
        returns: weeklyStats.success
          ? parseInt(weeklyStats.data.returns_this_week)
          : 0,
        fines_generated: weeklyStats.success
          ? parseInt(weeklyStats.data.fines_this_week)
          : 0,
        revenue: weeklyStats.success
          ? parseFloat(weeklyStats.data.revenue_this_week)
          : 0,
        popular_books: popularBooks.success ? popularBooks.data : [],
      },
      notifications: {
        due_today_count: dueToday.success ? dueToday.data.length : 0,
        overdue_count: overdueLoans.success ? overdueLoans.data.length : 0,
        pending_actions:
          (dueToday.success ? dueToday.data.length : 0) +
          (overdueLoans.success ? overdueLoans.data.length : 0),
      },
    };

    res.success(dashboard, "Dashboard de bibliotecario obtenido exitosamente");
  } catch (error) {
    logger.error("Error getting librarian dashboard:", error.message);
    res.serverError("Error al obtener dashboard");
  }
});

// Dashboard para administradores - estadísticas completas
const getAdminDashboard = asyncHandler(async (req, res) => {
  try {
    // Estadísticas generales del sistema
    const systemStats = await executeQuerySingle(
      `SELECT 
         (SELECT COUNT(*) FROM users WHERE role = 'user' AND is_active = true) as total_users,
         (SELECT COUNT(*) FROM books) as total_books,
         (SELECT SUM(total_copies) FROM books) as total_copies,
         (SELECT SUM(available_copies) FROM books) as available_copies,
         (SELECT COUNT(*) FROM loans WHERE status = 'active') as active_loans,
         (SELECT COUNT(*) FROM loans WHERE status = 'overdue') as overdue_loans,
         (SELECT COUNT(*) FROM fines WHERE is_paid = false) as unpaid_fines,
         (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE is_paid = false) as unpaid_amount`,
      [],
      "Get system stats for admin"
    );

    // Estadísticas mensuales
    const monthlyStats = await executeQuerySingle(
      `SELECT 
         COUNT(CASE WHEN l.loan_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as loans_this_month,
         COUNT(CASE WHEN l.return_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as returns_this_month,
         COUNT(CASE WHEN u.created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as new_users_this_month,
         COALESCE(SUM(CASE WHEN f.paid_date >= date_trunc('month', CURRENT_DATE) THEN f.amount END), 0) as revenue_this_month
       FROM loans l
       FULL OUTER JOIN users u ON l.user_id = u.id
       FULL OUTER JOIN fines f ON l.id = f.loan_id`,
      [],
      "Get monthly stats for admin"
    );

    // Top usuarios más activos
    const topUsers = await executeQuery(
      `SELECT u.first_name, u.last_name, u.email,
              COUNT(l.id) as total_loans,
              COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
              COALESCE(SUM(f.amount), 0) as total_fines
       FROM users u
       LEFT JOIN loans l ON u.id = l.user_id
       LEFT JOIN fines f ON l.id = f.loan_id
       WHERE u.role = 'user'
       GROUP BY u.id, u.first_name, u.last_name, u.email
       ORDER BY total_loans DESC
       LIMIT 10`,
      [],
      "Get top active users"
    );

    // Libros más populares (histórico)
    const popularBooks = await executeQuery(
      `SELECT b.title, b.isbn, COUNT(l.id) as total_loans,
              b.available_copies, b.total_copies,
              STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
       FROM books b
       LEFT JOIN loans l ON b.id = l.book_id
       LEFT JOIN book_authors ba ON b.id = ba.book_id
       LEFT JOIN authors a ON ba.author_id = a.id
       GROUP BY b.id, b.title, b.isbn, b.available_copies, b.total_copies
       ORDER BY total_loans DESC
       LIMIT 10`,
      [],
      "Get most popular books"
    );

    // Categorías más prestadas
    const popularCategories = await executeQuery(
      `SELECT c.name, COUNT(l.id) as loan_count,
              COUNT(DISTINCT b.id) as unique_books
       FROM categories c
       LEFT JOIN books b ON c.id = b.category_id
       LEFT JOIN loans l ON b.id = l.book_id
       GROUP BY c.id, c.name
       ORDER BY loan_count DESC
       LIMIT 5`,
      [],
      "Get popular categories"
    );

    // Tendencia de préstamos últimos 6 meses
    const loanTrends = await executeQuery(
      `SELECT 
         TO_CHAR(loan_date, 'YYYY-MM') as month,
         COUNT(*) as loan_count,
         COUNT(DISTINCT user_id) as unique_users
       FROM loans 
       WHERE loan_date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY TO_CHAR(loan_date, 'YYYY-MM')
       ORDER BY month DESC`,
      [],
      "Get loan trends for admin"
    );

    // Estadísticas de multas
    const fineStats = await executeQuerySingle(
      `SELECT 
         COUNT(*) as total_fines,
         COUNT(CASE WHEN is_paid = true THEN 1 END) as paid_fines,
         COUNT(CASE WHEN is_paid = false THEN 1 END) as unpaid_fines,
         COALESCE(SUM(amount), 0) as total_amount,
         COALESCE(SUM(CASE WHEN is_paid = true THEN amount END), 0) as total_revenue,
         COALESCE(AVG(amount), 0) as avg_fine_amount
       FROM fines`,
      [],
      "Get fine statistics for admin"
    );

    const dashboard = {
      system_overview: {
        users: systemStats.success ? parseInt(systemStats.data.total_users) : 0,
        books: systemStats.success ? parseInt(systemStats.data.total_books) : 0,
        total_copies: systemStats.success
          ? parseInt(systemStats.data.total_copies)
          : 0,
        available_copies: systemStats.success
          ? parseInt(systemStats.data.available_copies)
          : 0,
        utilization_rate: systemStats.success
          ? Math.round(
              ((parseInt(systemStats.data.total_copies) -
                parseInt(systemStats.data.available_copies)) /
                parseInt(systemStats.data.total_copies)) *
                100
            )
          : 0,
        active_loans: systemStats.success
          ? parseInt(systemStats.data.active_loans)
          : 0,
        overdue_loans: systemStats.success
          ? parseInt(systemStats.data.overdue_loans)
          : 0,
      },
      financial: {
        unpaid_fines_count: systemStats.success
          ? parseInt(systemStats.data.unpaid_fines)
          : 0,
        unpaid_amount: systemStats.success
          ? parseFloat(systemStats.data.unpaid_amount)
          : 0,
        monthly_revenue: monthlyStats.success
          ? parseFloat(monthlyStats.data.revenue_this_month)
          : 0,
        total_fines: fineStats.success
          ? parseInt(fineStats.data.total_fines)
          : 0,
        total_revenue: fineStats.success
          ? parseFloat(fineStats.data.total_revenue)
          : 0,
        avg_fine: fineStats.success
          ? parseFloat(fineStats.data.avg_fine_amount)
          : 0,
      },
      monthly_activity: {
        loans: monthlyStats.success
          ? parseInt(monthlyStats.data.loans_this_month)
          : 0,
        returns: monthlyStats.success
          ? parseInt(monthlyStats.data.returns_this_month)
          : 0,
        new_users: monthlyStats.success
          ? parseInt(monthlyStats.data.new_users_this_month)
          : 0,
      },
      top_performers: {
        users: topUsers.success ? topUsers.data : [],
        books: popularBooks.success ? popularBooks.data : [],
        categories: popularCategories.success ? popularCategories.data : [],
      },
      trends: {
        loan_history: loanTrends.success ? loanTrends.data : [],
      },
      alerts: {
        overdue_loans: systemStats.success
          ? parseInt(systemStats.data.overdue_loans)
          : 0,
        unpaid_fines: systemStats.success
          ? parseInt(systemStats.data.unpaid_fines)
          : 0,
        low_stock_books: 0, // Se calcularía con una query adicional si se necesita
      },
    };

    res.success(dashboard, "Dashboard de administrador obtenido exitosamente");
  } catch (error) {
    logger.error("Error getting admin dashboard:", error.message);
    res.serverError("Error al obtener dashboard");
  }
});

// Reporte mensual detallado (solo admin)
const getMonthlyReport = asyncHandler(async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentDate = new Date();
    const reportYear = year ? parseInt(year) : currentDate.getFullYear();
    const reportMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

    // Validar parámetros
    if (reportYear < 2020 || reportYear > currentDate.getFullYear() + 1) {
      return res.validationError({ year: "Año inválido" });
    }
    if (reportMonth < 1 || reportMonth > 12) {
      return res.validationError({ month: "Mes inválido" });
    }

    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0);

    // Estadísticas de préstamos del mes
    const loanStats = await executeQuerySingle(
      `SELECT 
         COUNT(*) as total_loans,
         COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as returned_loans,
         COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_loans,
         COUNT(DISTINCT user_id) as unique_borrowers,
         AVG(CASE WHEN return_date IS NOT NULL THEN return_date - loan_date END) as avg_loan_duration
       FROM loans 
       WHERE loan_date >= $1 AND loan_date <= $2`,
      [
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
      ],
      "Get monthly loan statistics"
    );

    // Estadísticas de multas del mes
    const fineStats = await executeQuerySingle(
      `SELECT 
         COUNT(*) as fines_generated,
         COUNT(CASE WHEN is_paid = true THEN 1 END) as fines_paid,
         COALESCE(SUM(amount), 0) as total_amount,
         COALESCE(SUM(CASE WHEN is_paid = true THEN amount END), 0) as revenue_collected
       FROM fines 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate.toISOString(), endDate.toISOString()],
      "Get monthly fine statistics"
    );

    // Libros más prestados del mes
    const topBooks = await executeQuery(
      `SELECT b.title, b.isbn, COUNT(l.id) as loan_count,
              STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
       FROM loans l
       JOIN books b ON l.book_id = b.id
       LEFT JOIN book_authors ba ON b.id = ba.book_id
       LEFT JOIN authors a ON ba.author_id = a.id
       WHERE l.loan_date >= $1 AND l.loan_date <= $2
       GROUP BY b.id, b.title, b.isbn
       ORDER BY loan_count DESC
       LIMIT 10`,
      [
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
      ],
      "Get top books for month"
    );

    // Nuevos usuarios registrados
    const newUsers = await executeQuerySingle(
      `SELECT COUNT(*) as new_users
       FROM users 
       WHERE created_at >= $1 AND created_at <= $2 AND role = 'user'`,
      [startDate.toISOString(), endDate.toISOString()],
      "Get new users for month"
    );

    const report = {
      period: {
        month: reportMonth,
        year: reportYear,
        month_name: startDate.toLocaleDateString("es-ES", { month: "long" }),
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      },
      loans: {
        total: loanStats.success ? parseInt(loanStats.data.total_loans) : 0,
        returned: loanStats.success
          ? parseInt(loanStats.data.returned_loans)
          : 0,
        overdue: loanStats.success ? parseInt(loanStats.data.overdue_loans) : 0,
        unique_borrowers: loanStats.success
          ? parseInt(loanStats.data.unique_borrowers)
          : 0,
        avg_duration_days: loanStats.success
          ? Math.round(parseFloat(loanStats.data.avg_loan_duration) || 0)
          : 0,
        return_rate: loanStats.success
          ? Math.round(
              (parseInt(loanStats.data.returned_loans) /
                parseInt(loanStats.data.total_loans)) *
                100
            )
          : 0,
      },
      fines: {
        generated: fineStats.success
          ? parseInt(fineStats.data.fines_generated)
          : 0,
        paid: fineStats.success ? parseInt(fineStats.data.fines_paid) : 0,
        total_amount: fineStats.success
          ? parseFloat(fineStats.data.total_amount)
          : 0,
        revenue_collected: fineStats.success
          ? parseFloat(fineStats.data.revenue_collected)
          : 0,
        collection_rate: fineStats.success
          ? Math.round(
              (parseInt(fineStats.data.fines_paid) /
                parseInt(fineStats.data.fines_generated)) *
                100
            )
          : 0,
      },
      top_books: topBooks.success ? topBooks.data : [],
      new_users: newUsers.success ? parseInt(newUsers.data.new_users) : 0,
      generated_at: new Date().toISOString(),
      generated_by: req.user.id,
    };

    logger.audit("Monthly report generated", {
      year: reportYear,
      month: reportMonth,
      generated_by: req.user.id,
    });

    res.success(
      report,
      `Reporte mensual de ${report.period.month_name} ${reportYear} generado exitosamente`
    );
  } catch (error) {
    logger.error("Error generating monthly report:", error.message);
    res.serverError("Error al generar reporte mensual");
  }
});

// Reporte de actividad de usuarios (solo admin)
const getUserActivityReport = asyncHandler(async (req, res) => {
  try {
    const pagination = validatePagination(req.query);
    const { active_only, with_fines } = req.query;

    let whereConditions = ["u.role = 'user'"];
    let params = [];

    if (active_only === "true") {
      whereConditions.push("loan_stats.active_loans > 0");
    }

    if (with_fines === "true") {
      whereConditions.push("fine_stats.unpaid_fines > 0");
    }

    const userActivityQuery = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.created_at, u.last_login,
             COALESCE(loan_stats.total_loans, 0) as total_loans,
             COALESCE(loan_stats.active_loans, 0) as active_loans,
             COALESCE(loan_stats.overdue_loans, 0) as overdue_loans,
             COALESCE(fine_stats.total_fines, 0) as total_fines,
             COALESCE(fine_stats.unpaid_fines, 0) as unpaid_fines,
             COALESCE(fine_stats.total_fine_amount, 0) as total_fine_amount,
             CASE 
               WHEN loan_stats.active_loans > 0 THEN 'active'
               WHEN fine_stats.unpaid_fines > 0 THEN 'has_fines'
               WHEN loan_stats.total_loans > 0 THEN 'inactive'
               ELSE 'never_borrowed'
             END as status
      FROM users u
      LEFT JOIN (
        SELECT user_id, 
               COUNT(*) as total_loans,
               COUNT(CASE WHEN status IN ('active', 'overdue') THEN 1 END) as active_loans,
               COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_loans
        FROM loans 
        GROUP BY user_id
      ) loan_stats ON u.id = loan_stats.user_id
      LEFT JOIN (
        SELECT user_id,
               COUNT(*) as total_fines,
               COUNT(CASE WHEN is_paid = false THEN 1 END) as unpaid_fines,
               COALESCE(SUM(CASE WHEN is_paid = false THEN amount END), 0) as total_fine_amount
        FROM fines
        GROUP BY user_id
      ) fine_stats ON u.id = fine_stats.user_id
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY loan_stats.total_loans DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN (
        SELECT user_id, 
               COUNT(*) as total_loans,
               COUNT(CASE WHEN status IN ('active', 'overdue') THEN 1 END) as active_loans
        FROM loans 
        GROUP BY user_id
      ) loan_stats ON u.id = loan_stats.user_id
      LEFT JOIN (
        SELECT user_id,
               COUNT(CASE WHEN is_paid = false THEN 1 END) as unpaid_fines
        FROM fines
        GROUP BY user_id
      ) fine_stats ON u.id = fine_stats.user_id
      WHERE ${whereConditions.join(" AND ")}
    `;

    const result = await executeQuery(
      userActivityQuery,
      [...params, pagination.limit, (pagination.page - 1) * pagination.limit],
      "Get user activity report"
    );

    const countResult = await executeQuerySingle(
      countQuery,
      params,
      "Count users for activity report"
    );

    if (!result.success) {
      return res.serverError("Error al generar reporte de actividad");
    }

    const response = {
      users: result.data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: countResult.success ? parseInt(countResult.data.total) : 0,
        pages: countResult.success
          ? Math.ceil(parseInt(countResult.data.total) / pagination.limit)
          : 0,
      },
      summary: {
        total_users: countResult.success ? parseInt(countResult.data.total) : 0,
        active_users: result.data.filter((u) => u.status === "active").length,
        users_with_fines: result.data.filter((u) => u.unpaid_fines > 0).length,
        never_borrowed: result.data.filter((u) => u.status === "never_borrowed")
          .length,
      },
      generated_at: new Date().toISOString(),
    };

    logger.audit("User activity report generated", {
      filters: { active_only, with_fines },
      generated_by: req.user.id,
    });

    res.success(
      response,
      "Reporte de actividad de usuarios generado exitosamente"
    );
  } catch (error) {
    logger.error("Error generating user activity report:", error.message);
    res.serverError("Error al generar reporte de actividad");
  }
});

module.exports = {
  getUserDashboard,
  getLibrarianDashboard,
  getAdminDashboard,
  getMonthlyReport,
  getUserActivityReport,
};
