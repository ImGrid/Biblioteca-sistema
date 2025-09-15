const USERS_QUERIES = {
  // Autenticación
  FIND_BY_EMAIL: `
        SELECT id, email, password_hash, first_name, last_name, role, is_active, 
               email_verified, max_loans, created_at, last_login
        FROM users 
        WHERE email = $1 AND is_active = true
    `,

  // Crear usuario
  CREATE_USER: `
        INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, first_name, last_name, role, created_at
    `,

  // Actualizar último login
  UPDATE_LAST_LOGIN: `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `,

  // Obtener perfil de usuario
  GET_USER_PROFILE: `
        SELECT id, email, first_name, last_name, phone, address, role, 
               max_loans, created_at, last_login
        FROM users 
        WHERE id = $1 AND is_active = true
    `,

  // Verificar existencia de email
  CHECK_EMAIL_EXISTS: `
        SELECT id FROM users WHERE email = $1
    `,

  // Listar usuarios (solo admin)
  LIST_USERS: `
        SELECT id, email, first_name, last_name, role, is_active, 
               created_at, last_login
        FROM users 
        WHERE role != 'admin'
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
    `,

  // Contar usuarios
  COUNT_USERS: `
        SELECT COUNT(*) as total FROM users WHERE role != 'admin'
    `,

  // Obtener estadísticas de usuario con préstamos y multas
  GET_USER_STATS: `
        SELECT 
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
        WHERE u.id = $1 AND u.is_active = true
    `,
};

const BOOKS_QUERIES = {
  // Búsqueda de libros con filtros
  SEARCH_BOOKS: `
        SELECT b.id, b.title, b.isbn, b.publisher, b.publication_year,
               b.total_copies, b.available_copies, b.location, b.description,
               c.name as category_name,
               STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ' ORDER BY ba.id) as authors
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN book_authors ba ON b.id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.id
        WHERE ($1 IS NULL OR LOWER(b.title) LIKE LOWER('%' || $1 || '%'))
        AND ($2 IS NULL OR b.category_id = $2)
        AND ($3 IS NULL OR b.available_copies > 0)
        GROUP BY b.id, b.title, b.isbn, b.publisher, b.publication_year,
                 b.total_copies, b.available_copies, b.location, b.description, c.name
        ORDER BY b.title
        LIMIT $4 OFFSET $5
    `,

  // Obtener libro por ID
  GET_BOOK_BY_ID: `
        SELECT b.id, b.title, b.isbn, b.publisher, b.publication_year,
               b.total_copies, b.available_copies, b.location, b.description,
               c.name as category_name, c.id as category_id,
               STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ' ORDER BY ba.id) as authors,
               ARRAY_AGG(a.id ORDER BY ba.id) as author_ids
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN book_authors ba ON b.id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.id
        WHERE b.id = $1
        GROUP BY b.id, b.title, b.isbn, b.publisher, b.publication_year,
                 b.total_copies, b.available_copies, b.location, b.description, 
                 c.name, c.id
    `,

  // Crear libro
  CREATE_BOOK: `
        INSERT INTO books (title, isbn, publisher, publication_year, category_id,
                          total_copies, available_copies, location, description, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9)
        RETURNING id, title, isbn, created_at
    `,

  // Actualizar libro
  UPDATE_BOOK: `
        UPDATE books 
        SET title = $1, isbn = $2, publisher = $3, publication_year = $4,
            category_id = $5, total_copies = $6, location = $7, 
            description = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING id, title, updated_at
    `,

  // Verificar disponibilidad
  CHECK_AVAILABILITY: `
        SELECT available_copies FROM books WHERE id = $1
    `,

  // Actualizar disponibilidad
  UPDATE_AVAILABILITY: `
        UPDATE books 
        SET available_copies = available_copies + $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING available_copies
    `,

  // Contar libros
  COUNT_BOOKS: `
        SELECT COUNT(*) as total FROM books
        WHERE ($1 IS NULL OR LOWER(title) LIKE LOWER('%' || $1 || '%'))
        AND ($2 IS NULL OR category_id = $2)
        AND ($3 IS NULL OR available_copies > 0)
    `,

  // Decrementar disponibilidad para préstamo
  DECREASE_AVAILABILITY: `
        UPDATE books 
        SET available_copies = available_copies - 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND available_copies > 0
        RETURNING available_copies
    `,

  // Incrementar disponibilidad para devolución
  INCREASE_AVAILABILITY: `
        UPDATE books 
        SET available_copies = available_copies + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING available_copies
    `,
};

const AUTHORS_QUERIES = {
  // Listar autores
  LIST_AUTHORS: `
        SELECT id, first_name, last_name, bio, birth_date, created_at
        FROM authors 
        ORDER BY last_name, first_name
        LIMIT $1 OFFSET $2
    `,

  // Crear autor
  CREATE_AUTHOR: `
        INSERT INTO authors (first_name, last_name, bio, birth_date)
        VALUES ($1, $2, $3, $4)
        RETURNING id, first_name, last_name, created_at
    `,

  // Buscar autor por nombre
  FIND_AUTHOR_BY_NAME: `
        SELECT id, first_name, last_name 
        FROM authors 
        WHERE LOWER(first_name || ' ' || last_name) LIKE LOWER('%' || $1 || '%')
        ORDER BY last_name, first_name
        LIMIT 10
    `,

  // Verificar si autor existe
  CHECK_AUTHOR_EXISTS: `
        SELECT id FROM authors 
        WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
    `,
};

const CATEGORIES_QUERIES = {
  // Listar categorías
  LIST_CATEGORIES: `
        SELECT id, name, description, created_at
        FROM categories 
        ORDER BY name
    `,

  // Crear categoría
  CREATE_CATEGORY: `
        INSERT INTO categories (name, description)
        VALUES ($1, $2)
        RETURNING id, name, created_at
    `,

  // Verificar si categoría existe
  CHECK_CATEGORY_EXISTS: `
        SELECT id FROM categories WHERE LOWER(name) = LOWER($1)
    `,
};

// Queries de préstamos
const LOANS_QUERIES = {
  // Crear préstamo
  CREATE_LOAN: `
      INSERT INTO loans (user_id, book_id, loan_date, due_date, created_by)
      VALUES ($1, $2, CURRENT_DATE, $3, $4)
      RETURNING id, loan_date, due_date
    `,

  // Obtener préstamos activos de usuario
  GET_USER_ACTIVE_LOANS: `
        SELECT COUNT(*) as active_loans
        FROM loans 
        WHERE user_id = $1 AND status = 'active'
    `,

  // Procesar devolución
  PROCESS_RETURN: `
        UPDATE loans 
        SET return_date = CURRENT_DATE, status = 'returned', 
            notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL THEN '\n' ELSE '' END || $2, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status IN ('active', 'overdue')
        RETURNING id, book_id, user_id
    `,

  // Obtener préstamos de usuario
  GET_USER_LOANS: `
        SELECT l.id, l.loan_date, l.due_date, l.return_date, l.status,
               b.title, b.isbn, l.notes,
               STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors,
               CASE 
                   WHEN l.status = 'active' AND l.due_date < CURRENT_DATE 
                   THEN CURRENT_DATE - l.due_date 
                   ELSE 0 
               END as days_overdue
        FROM loans l
        JOIN books b ON l.book_id = b.id
        LEFT JOIN book_authors ba ON b.id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.id
        WHERE l.user_id = $1
        GROUP BY l.id, l.loan_date, l.due_date, l.return_date, l.status,
                 b.title, b.isbn, l.notes
        ORDER BY l.loan_date DESC
        LIMIT $2 OFFSET $3
    `,

  // Obtener préstamos vencidos
  GET_OVERDUE_LOANS: `
        SELECT l.id, l.user_id, l.book_id, l.due_date,
               CURRENT_DATE - l.due_date as days_overdue,
               u.first_name, u.last_name, u.email, b.title
        FROM loans l
        JOIN users u ON l.user_id = u.id
        JOIN books b ON l.book_id = b.id
        WHERE l.status IN ('active', 'overdue') 
        AND l.due_date < CURRENT_DATE
        ORDER BY l.due_date ASC
    `,

  // Obtener préstamo por ID con información completa
  GET_LOAN_BY_ID: `
        SELECT l.*, 
               u.first_name, u.last_name, u.email,
               b.title, b.isbn,
               COALESCE(l.extensions, 0) as extensions
        FROM loans l
        JOIN users u ON l.user_id = u.id
        JOIN books b ON l.book_id = b.id
        WHERE l.id = $1
    `,

  // Extender préstamo
  EXTEND_LOAN: `
        UPDATE loans 
        SET due_date = due_date + INTERVAL '$1 days',
            extensions = COALESCE(extensions, 0) + 1,
            notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL THEN '\n' ELSE '' END || $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND status = 'active'
        RETURNING id, due_date, extensions
    `,

  // Actualizar estado de préstamo
  UPDATE_LOAN_STATUS: `
        UPDATE loans 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, status
    `,

  // Contar préstamos por estado
  COUNT_LOANS_BY_STATUS: `
        SELECT status, COUNT(*) as count
        FROM loans
        GROUP BY status
    `,

  // Obtener préstamos próximos a vencer
  GET_LOANS_DUE_SOON: `
        SELECT l.id, l.user_id, l.book_id, l.due_date,
               u.first_name, u.last_name, u.email,
               b.title, b.isbn,
               (l.due_date - CURRENT_DATE) as days_until_due
        FROM loans l
        JOIN users u ON l.user_id = u.id
        JOIN books b ON l.book_id = b.id
        WHERE l.status = 'active'
        AND l.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '$1 days'
        ORDER BY l.due_date ASC
    `,
};

// Queries de multas
const FINES_QUERIES = {
  // Crear multa
  CREATE_FINE: `
        INSERT INTO fines (loan_id, user_id, amount, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING id, amount, created_at
    `,

  // Obtener multas pendientes de usuario
  GET_USER_UNPAID_FINES: `
        SELECT COUNT(*) as unpaid_fines, COALESCE(SUM(amount), 0) as total_amount
        FROM fines 
        WHERE user_id = $1 AND is_paid = false
    `,

  // Procesar pago de multa
  PROCESS_FINE_PAYMENT: `
        UPDATE fines 
        SET is_paid = true, paid_date = CURRENT_TIMESTAMP, 
            paid_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_paid = false
        RETURNING id, amount
    `,

  // Obtener multas de usuario
  GET_USER_FINES: `
        SELECT f.id, f.amount, f.reason, f.is_paid, f.paid_date, f.created_at,
               l.loan_date, l.due_date, b.title
        FROM fines f
        LEFT JOIN loans l ON f.loan_id = l.id
        LEFT JOIN books b ON l.book_id = b.id
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3
    `,

  // Obtener todas las multas pendientes
  GET_ALL_UNPAID_FINES: `
        SELECT f.id, f.loan_id, f.user_id, f.amount, f.reason, f.created_at,
               u.first_name, u.last_name, u.email,
               b.title, b.isbn,
               l.due_date, l.loan_date
        FROM fines f
        JOIN users u ON f.user_id = u.id
        JOIN loans l ON f.loan_id = l.id
        JOIN books b ON l.book_id = b.id
        WHERE f.is_paid = false
        ORDER BY f.created_at DESC
    `,

  // Verificar si existe multa para un préstamo
  CHECK_FINE_EXISTS: `
        SELECT id FROM fines 
        WHERE loan_id = $1 AND reason LIKE $2
    `,

  // Obtener estadísticas de multas
  GET_FINES_STATS: `
        SELECT 
          COUNT(*) as total_fines,
          COUNT(CASE WHEN is_paid = false THEN 1 END) as unpaid_fines,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(CASE WHEN is_paid = false THEN amount ELSE 0 END), 0) as unpaid_amount,
          COALESCE(AVG(amount), 0) as avg_fine_amount
        FROM fines
    `,
};

const AUDIT_QUERIES = {
  // Registrar acción de auditoría
  LOG_ACTION: `
        INSERT INTO audit_logs (user_id, action, table_name, record_id, 
                               old_values, new_values, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, created_at
    `,

  // Obtener logs de auditoría
  GET_AUDIT_LOGS: `
        SELECT al.id, al.action, al.table_name, al.record_id, 
               al.created_at, al.ip_address,
               u.first_name, u.last_name, u.email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE ($1 IS NULL OR al.user_id = $1)
        AND ($2 IS NULL OR al.table_name = $2)
        ORDER BY al.created_at DESC
        LIMIT $3 OFFSET $4
    `,

  // Logs específicos de préstamos
  GET_LOAN_AUDIT_LOGS: `
        SELECT al.id, al.action, al.record_id, al.created_at,
               u.first_name, u.last_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.table_name = 'loans'
        AND ($1 IS NULL OR al.record_id = $1)
        ORDER BY al.created_at DESC
        LIMIT $2 OFFSET $3
    `,
};

const SYSTEM_QUERIES = {
  // Verificar tablas del sistema
  CHECK_TABLES: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `,

  // Obtener estadísticas básicas
  GET_BASIC_STATS: `
        SELECT 
            (SELECT COUNT(*) FROM users WHERE role = 'user' AND is_active = true) as total_users,
            (SELECT COUNT(*) FROM books) as total_books,
            (SELECT COUNT(*) FROM loans WHERE status = 'active') as active_loans,
            (SELECT COUNT(*) FROM fines WHERE is_paid = false) as unpaid_fines
    `,

  // NUEVO - Estadísticas completas del sistema para dashboard
  GET_DASHBOARD_STATS: `
        SELECT 
            -- Estadísticas de libros
            (SELECT COUNT(*) FROM books) as total_books,
            (SELECT COUNT(*) FROM books WHERE available_copies > 0) as available_books,
            (SELECT SUM(total_copies) FROM books) as total_copies,
            (SELECT SUM(available_copies) FROM books) as available_copies,
            
            -- Estadísticas de préstamos
            (SELECT COUNT(*) FROM loans WHERE status = 'active') as active_loans,
            (SELECT COUNT(*) FROM loans WHERE status = 'overdue') as overdue_loans,
            (SELECT COUNT(*) FROM loans WHERE due_date = CURRENT_DATE) as due_today,
            (SELECT COUNT(*) FROM loans WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3) as due_soon,
            
            -- Estadísticas de usuarios
            (SELECT COUNT(*) FROM users WHERE role = 'user' AND is_active = true) as active_users,
            (SELECT COUNT(DISTINCT user_id) FROM fines WHERE is_paid = false) as users_with_fines,
            
            -- Estadísticas de multas
            (SELECT COUNT(*) FROM fines WHERE is_paid = false) as unpaid_fines,
            (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE is_paid = false) as total_unpaid_amount,
            
            -- Estadísticas mensuales
            (SELECT COUNT(*) FROM loans WHERE loan_date >= date_trunc('month', CURRENT_DATE)) as loans_this_month,
            (SELECT COUNT(*) FROM loans WHERE return_date >= date_trunc('month', CURRENT_DATE)) as returns_this_month
    `,

  // Verificar integridad del sistema
  CHECK_SYSTEM_INTEGRITY: `
        SELECT 
            'books_integrity' as check_name,
            CASE 
                WHEN (SELECT COUNT(*) FROM books WHERE available_copies > total_copies) > 0 
                THEN 'FAILED: Available copies exceed total copies'
                ELSE 'PASSED'
            END as result
        UNION ALL
        SELECT 
            'loans_integrity' as check_name,
            CASE 
                WHEN (SELECT COUNT(*) FROM loans l WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = l.user_id)) > 0
                THEN 'FAILED: Orphaned loans found'
                ELSE 'PASSED'
            END as result
        UNION ALL
        SELECT 
            'fines_integrity' as check_name,
            CASE 
                WHEN (SELECT COUNT(*) FROM fines f WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.id = f.loan_id)) > 0
                THEN 'FAILED: Orphaned fines found'
                ELSE 'PASSED'
            END as result
    `,
};

// NUEVO - QUERIES ESPECÍFICAS PARA DASHBOARD (FASE 7)
const DASHBOARD_QUERIES = {
  // Dashboard de usuario - información personalizada
  USER_DASHBOARD: {
    // Préstamos activos del usuario con estado
    GET_USER_ACTIVE_LOANS: `
      SELECT l.id, l.loan_date, l.due_date, b.title, b.isbn,
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
      ORDER BY l.due_date ASC
    `,

    // Estadísticas de historial del usuario
    GET_USER_LOAN_HISTORY_STATS: `
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as returned_loans,
        AVG(CASE WHEN return_date IS NOT NULL THEN return_date - loan_date END) as avg_loan_duration
      FROM loans 
      WHERE user_id = $1
    `,

    // Libros favoritos del usuario
    GET_USER_FAVORITE_BOOKS: `
      SELECT b.title, b.isbn, COUNT(*) as times_borrowed,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
      FROM loans l
      JOIN books b ON l.book_id = b.id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      WHERE l.user_id = $1
      GROUP BY b.id, b.title, b.isbn
      ORDER BY times_borrowed DESC, b.title
      LIMIT 5
    `,
  },

  // Dashboard de bibliotecario - información operativa
  LIBRARIAN_DASHBOARD: {
    // Estadísticas del día
    GET_TODAY_STATS: `
      SELECT 
        COUNT(CASE WHEN l.loan_date = CURRENT_DATE THEN 1 END) as loans_today,
        COUNT(CASE WHEN l.return_date = CURRENT_DATE THEN 1 END) as returns_today,
        COUNT(CASE WHEN f.paid_date::date = CURRENT_DATE THEN 1 END) as payments_today
      FROM loans l
      FULL OUTER JOIN fines f ON l.id = f.loan_id
    `,

    // Préstamos que vencen hoy
    GET_DUE_TODAY: `
      SELECT l.id, l.due_date, u.first_name, u.last_name, u.email, u.phone,
             b.title, b.isbn
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
      WHERE l.status = 'active' AND l.due_date = CURRENT_DATE
      ORDER BY u.last_name, u.first_name
    `,

    // Préstamos vencidos para seguimiento
    GET_OVERDUE_FOR_LIBRARIAN: `
      SELECT l.id, l.due_date, (CURRENT_DATE - l.due_date) as days_overdue,
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
      LIMIT 10
    `,

    // Estadísticas semanales
    GET_WEEKLY_STATS: `
      SELECT 
        COUNT(CASE WHEN l.loan_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as loans_this_week,
        COUNT(CASE WHEN l.return_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as returns_this_week,
        COUNT(CASE WHEN f.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as fines_this_week,
        COALESCE(SUM(CASE WHEN f.paid_date >= CURRENT_DATE - INTERVAL '7 days' THEN f.amount END), 0) as revenue_this_week
      FROM loans l
      FULL OUTER JOIN fines f ON l.id = f.loan_id
    `,

    // Libros más prestados esta semana
    GET_POPULAR_BOOKS_WEEK: `
      SELECT b.title, b.isbn, COUNT(*) as loan_count,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
      FROM loans l
      JOIN books b ON l.book_id = b.id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      WHERE l.loan_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY b.id, b.title, b.isbn
      ORDER BY loan_count DESC
      LIMIT 5
    `,
  },

  // Dashboard de admin - estadísticas completas
  ADMIN_DASHBOARD: {
    // Estadísticas generales del sistema
    GET_SYSTEM_OVERVIEW: `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'user' AND is_active = true) as total_users,
        (SELECT COUNT(*) FROM books) as total_books,
        (SELECT SUM(total_copies) FROM books) as total_copies,
        (SELECT SUM(available_copies) FROM books) as available_copies,
        (SELECT COUNT(*) FROM loans WHERE status = 'active') as active_loans,
        (SELECT COUNT(*) FROM loans WHERE status = 'overdue') as overdue_loans,
        (SELECT COUNT(*) FROM fines WHERE is_paid = false) as unpaid_fines,
        (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE is_paid = false) as unpaid_amount
    `,

    // Estadísticas mensuales
    GET_MONTHLY_STATS: `
      SELECT 
        COUNT(CASE WHEN l.loan_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as loans_this_month,
        COUNT(CASE WHEN l.return_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as returns_this_month,
        COUNT(CASE WHEN u.created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as new_users_this_month,
        COALESCE(SUM(CASE WHEN f.paid_date >= date_trunc('month', CURRENT_DATE) THEN f.amount END), 0) as revenue_this_month
      FROM loans l
      FULL OUTER JOIN users u ON l.user_id = u.id
      FULL OUTER JOIN fines f ON l.id = f.loan_id
    `,

    // Top usuarios más activos
    GET_TOP_USERS: `
      SELECT u.first_name, u.last_name, u.email,
             COUNT(l.id) as total_loans,
             COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
             COALESCE(SUM(f.amount), 0) as total_fines
      FROM users u
      LEFT JOIN loans l ON u.id = l.user_id
      LEFT JOIN fines f ON l.id = f.loan_id
      WHERE u.role = 'user'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY total_loans DESC
      LIMIT 10
    `,

    // Libros más populares (histórico)
    GET_POPULAR_BOOKS_ALL_TIME: `
      SELECT b.title, b.isbn, COUNT(l.id) as total_loans,
             b.available_copies, b.total_copies,
             STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ') as authors
      FROM books b
      LEFT JOIN loans l ON b.id = l.book_id
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      GROUP BY b.id, b.title, b.isbn, b.available_copies, b.total_copies
      ORDER BY total_loans DESC
      LIMIT 10
    `,

    // Categorías más prestadas
    GET_POPULAR_CATEGORIES: `
      SELECT c.name, COUNT(l.id) as loan_count,
             COUNT(DISTINCT b.id) as unique_books
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      LEFT JOIN loans l ON b.id = l.book_id
      GROUP BY c.id, c.name
      ORDER BY loan_count DESC
      LIMIT 5
    `,

    // Tendencia de préstamos últimos 6 meses
    GET_LOAN_TRENDS: `
      SELECT 
        TO_CHAR(loan_date, 'YYYY-MM') as month,
        COUNT(*) as loan_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM loans 
      WHERE loan_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(loan_date, 'YYYY-MM')
      ORDER BY month DESC
    `,

    // Estadísticas completas de multas
    GET_COMPLETE_FINE_STATS: `
      SELECT 
        COUNT(*) as total_fines,
        COUNT(CASE WHEN is_paid = true THEN 1 END) as paid_fines,
        COUNT(CASE WHEN is_paid = false THEN 1 END) as unpaid_fines,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN is_paid = true THEN amount END), 0) as total_revenue,
        COALESCE(AVG(amount), 0) as avg_fine_amount
      FROM fines
    `,
  },

  // Reportes detallados
  REPORTS: {
    // Reporte mensual detallado
    GET_MONTHLY_REPORT: `
      WITH daily_stats AS (
        SELECT 
          DATE(f.created_at) as report_date,
          COUNT(*) as fines_generated,
          SUM(f.amount) as amount_generated,
          COUNT(CASE WHEN f.is_paid = true AND DATE(f.paid_date) = DATE(f.created_at) THEN 1 END) as same_day_payments,
          SUM(CASE WHEN f.is_paid = true AND DATE(f.paid_date) = DATE(f.created_at) THEN f.amount ELSE 0 END) as same_day_revenue
        FROM fines f
        WHERE f.created_at >= $1 AND f.created_at < $2
        GROUP BY DATE(f.created_at)
      ),
      monthly_summary AS (
        SELECT 
          COUNT(*) as total_fines,
          SUM(f.amount) as total_generated,
          COUNT(CASE WHEN f.is_paid = true THEN 1 END) as paid_fines,
          SUM(CASE WHEN f.is_paid = true THEN f.amount ELSE 0 END) as total_revenue,
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
    `,

    // Actividad de usuarios para reportes
    GET_USER_ACTIVITY_REPORT: `
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
      WHERE u.role = 'user'
      ORDER BY loan_stats.total_loans DESC NULLS LAST
    `,
  },
};

module.exports = {
  USERS_QUERIES,
  BOOKS_QUERIES,
  AUTHORS_QUERIES,
  CATEGORIES_QUERIES,
  LOANS_QUERIES,
  FINES_QUERIES,
  AUDIT_QUERIES,
  SYSTEM_QUERIES,
  DASHBOARD_QUERIES,
};
