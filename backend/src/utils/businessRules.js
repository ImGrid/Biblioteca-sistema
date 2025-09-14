// Reglas de negocio configurables para el sistema de biblioteca

// Configuración de préstamos
const LOAN_RULES = {
  // Límites por usuario
  MAX_LOANS_PER_USER: 3,
  LOAN_PERIOD_DAYS: 14,

  // Extensión de préstamos
  MAX_EXTENSIONS: 2,
  EXTENSION_DAYS: 7,

  // Multas
  FINE_PER_DAY: 10.0, // en pesos
  GRACE_PERIOD_DAYS: 1, // días de gracia antes de multar
  MAX_FINE_AMOUNT: 500.0, // multa máxima por libro

  // Estados de préstamo válidos
  VALID_LOAN_STATUSES: ["active", "returned", "overdue", "lost"],

  // Validaciones de negocio
  ALLOW_LOANS_WITH_FINES: false, // No permitir préstamos si hay multas pendientes
  REQUIRE_PHYSICAL_VERIFICATION: true, // Verificar disponibilidad física del libro
};

// Reglas por rol de usuario
const ROLE_PERMISSIONS = {
  admin: {
    can_process_loans: true,
    can_process_returns: true,
    can_extend_loans: true,
    can_override_limits: true,
    can_waive_fines: true,
    can_access_all_loans: true,
    can_generate_reports: true,
  },
  librarian: {
    can_process_loans: true,
    can_process_returns: true,
    can_extend_loans: true,
    can_override_limits: false,
    can_waive_fines: false,
    can_access_all_loans: true,
    can_generate_reports: true,
  },
  user: {
    can_process_loans: false,
    can_process_returns: false,
    can_extend_loans: false,
    can_override_limits: false,
    can_waive_fines: false,
    can_access_all_loans: false,
    can_generate_reports: false,
    can_view_own_loans: true,
  },
};

// Validar si un usuario puede realizar una acción específica
const canUserPerformAction = (userRole, action) => {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) {
    return false;
  }
  return permissions[action] || false;
};

// Calcular fecha de devolución
const calculateDueDate = (
  loanDate = new Date(),
  loanPeriodDays = LOAN_RULES.LOAN_PERIOD_DAYS
) => {
  const dueDate = new Date(loanDate);
  dueDate.setDate(dueDate.getDate() + loanPeriodDays);
  return dueDate;
};

// Calcular días de retraso
const calculateOverdueDays = (dueDate) => {
  const today = new Date();
  const due = new Date(dueDate);

  // Solo considerar retraso si ya pasó el día de devolución
  if (today <= due) {
    return 0;
  }

  const timeDiff = today.getTime() - due.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  // Aplicar período de gracia
  return Math.max(0, daysDiff - LOAN_RULES.GRACE_PERIOD_DAYS);
};

// Calcular multa por retraso
const calculateFineAmount = (overdueDays) => {
  if (overdueDays <= 0) {
    return 0;
  }

  const fineAmount = overdueDays * LOAN_RULES.FINE_PER_DAY;
  return Math.min(fineAmount, LOAN_RULES.MAX_FINE_AMOUNT);
};

// Validar elegibilidad para préstamo
const validateLoanEligibility = (userStats) => {
  const errors = [];

  // Verificar límite de préstamos activos
  if (userStats.active_loans >= LOAN_RULES.MAX_LOANS_PER_USER) {
    errors.push(
      `Límite de préstamos alcanzado (máximo ${LOAN_RULES.MAX_LOANS_PER_USER})`
    );
  }

  // Verificar multas pendientes (si está configurado)
  if (!LOAN_RULES.ALLOW_LOANS_WITH_FINES && userStats.unpaid_fines_count > 0) {
    errors.push("Usuario tiene multas pendientes de pago");
  }

  // Verificar préstamos vencidos
  if (userStats.overdue_loans > 0) {
    errors.push("Usuario tiene préstamos vencidos");
  }

  return {
    eligible: errors.length === 0,
    reasons: errors,
  };
};

// Validar disponibilidad de libro
const validateBookAvailability = (bookData) => {
  const errors = [];

  // Verificar que el libro existe
  if (!bookData) {
    errors.push("Libro no encontrado");
    return { available: false, reasons: errors };
  }

  // Verificar copias disponibles
  if (bookData.available_copies <= 0) {
    errors.push("No hay copias disponibles");
  }

  return {
    available: errors.length === 0,
    reasons: errors,
  };
};

// Generar código único de préstamo (opcional)
const generateLoanCode = (userId, bookId) => {
  const timestamp = Date.now().toString(36);
  const userPart = userId.toString(36).padStart(2, "0");
  const bookPart = bookId.toString(36).padStart(2, "0");
  return `L-${userPart}-${bookPart}-${timestamp}`.toUpperCase();
};

// Determinar próxima fecha de revisión para préstamos vencidos
const getNextReviewDate = (overdueDays) => {
  let daysToAdd = 7; // Por defecto, revisar en 1 semana

  if (overdueDays > 30) {
    daysToAdd = 3; // Revisar cada 3 días si está muy vencido
  } else if (overdueDays > 14) {
    daysToAdd = 5; // Revisar cada 5 días
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + daysToAdd);
  return nextReview;
};

// Configuración de notificaciones
const NOTIFICATION_RULES = {
  // Días antes del vencimiento para enviar recordatorio
  REMINDER_DAYS_BEFORE_DUE: [3, 1],

  // Días después del vencimiento para enviar notificación
  OVERDUE_NOTIFICATION_DAYS: [1, 3, 7, 14, 30],

  // Plantillas de mensajes
  MESSAGES: {
    REMINDER: "Su préstamo vence en {days} días. Libro: {title}",
    OVERDUE:
      "Su préstamo está vencido por {days} días. Libro: {title}. Multa actual: ${fine}",
    RETURN_REMINDER:
      'Recordatorio: Debe devolver "{title}" antes del {due_date}',
  },
};

// Crear mensaje de notificación
const createNotificationMessage = (type, data) => {
  const template = NOTIFICATION_RULES.MESSAGES[type];
  if (!template) {
    return "Notificación de biblioteca";
  }

  return template
    .replace("{days}", data.days || 0)
    .replace("{title}", data.title || "Libro")
    .replace("{fine}", data.fine || 0)
    .replace("{due_date}", data.due_date || "");
};

// Reglas de extensión de préstamo
const validateLoanExtension = (loanData, userStats) => {
  const errors = [];

  // Verificar que el préstamo no esté vencido
  if (loanData.status === "overdue") {
    errors.push("No se puede extender un préstamo vencido");
  }

  // Verificar límite de extensiones
  const extensions = loanData.extensions || 0;
  if (extensions >= LOAN_RULES.MAX_EXTENSIONS) {
    errors.push(
      `Límite de extensiones alcanzado (máximo ${LOAN_RULES.MAX_EXTENSIONS})`
    );
  }

  // Verificar que no hay multas pendientes
  if (userStats.unpaid_fines_count > 0) {
    errors.push("No se puede extender préstamo con multas pendientes");
  }

  // Verificar que no hay reservas en espera para este libro
  // (Esta lógica se implementaría cuando tengamos sistema de reservas)

  return {
    canExtend: errors.length === 0,
    reasons: errors,
  };
};

module.exports = {
  LOAN_RULES,
  ROLE_PERMISSIONS,
  NOTIFICATION_RULES,
  canUserPerformAction,
  calculateDueDate,
  calculateOverdueDays,
  calculateFineAmount,
  validateLoanEligibility,
  validateBookAvailability,
  generateLoanCode,
  getNextReviewDate,
  createNotificationMessage,
  validateLoanExtension,
};
