const {
  validateId,
  validateInteger,
  validateString,
} = require("../utils/validation");
const { canUserPerformAction } = require("../utils/businessRules");
const { asyncHandler, createValidationError } = require("./errorHandler");
const logger = require("../utils/logger");

// Validar datos para crear préstamo
const validateLoanData = (data) => {
  const errors = {};
  const validatedData = {};

  // User ID
  const userIdValidation = validateId(data.user_id, "ID del usuario");
  if (!userIdValidation.valid) {
    errors.user_id = userIdValidation.error;
  } else {
    validatedData.user_id = userIdValidation.value;
  }

  // Book ID
  const bookIdValidation = validateId(data.book_id, "ID del libro");
  if (!bookIdValidation.valid) {
    errors.book_id = bookIdValidation.error;
  } else {
    validatedData.book_id = bookIdValidation.value;
  }

  // Loan days (opcional, usa default de reglas de negocio)
  if (data.loan_days !== undefined) {
    const loanDaysValidation = validateInteger(
      data.loan_days,
      "Días de préstamo",
      {
        min: 1,
        max: 30,
        required: false,
      }
    );
    if (!loanDaysValidation.valid) {
      errors.loan_days = loanDaysValidation.error;
    } else {
      validatedData.loan_days = loanDaysValidation.value;
    }
  }

  // Notes (opcional)
  if (data.notes !== undefined) {
    const notesValidation = validateString(data.notes, "Notas", {
      required: false,
      maxLength: 500,
    });
    if (!notesValidation.valid) {
      errors.notes = notesValidation.error;
    } else {
      validatedData.notes = notesValidation.value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Validar datos para devolución de préstamo
const validateReturnData = (data) => {
  const errors = {};
  const validatedData = {};

  // Notes (opcional pero recomendado)
  if (data.notes !== undefined) {
    const notesValidation = validateString(data.notes, "Notas de devolución", {
      required: false,
      maxLength: 500,
    });
    if (!notesValidation.valid) {
      errors.notes = notesValidation.error;
    } else {
      validatedData.notes = notesValidation.value;
    }
  }

  // Condition (opcional - estado del libro al devolverse)
  if (data.condition !== undefined) {
    const validConditions = ["good", "fair", "damaged", "lost"];
    if (!validConditions.includes(data.condition)) {
      errors.condition = `Condición debe ser: ${validConditions.join(", ")}`;
    } else {
      validatedData.condition = data.condition;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Validar datos para extensión de préstamo
const validateExtensionData = (data) => {
  const errors = {};
  const validatedData = {};

  // Extension days (opcional, usa default)
  if (data.extension_days !== undefined) {
    const extensionDaysValidation = validateInteger(
      data.extension_days,
      "Días de extensión",
      {
        min: 1,
        max: 14,
        required: false,
      }
    );
    if (!extensionDaysValidation.valid) {
      errors.extension_days = extensionDaysValidation.error;
    } else {
      validatedData.extension_days = extensionDaysValidation.value;
    }
  }

  // Reason (opcional pero recomendado para auditoría)
  if (data.reason !== undefined) {
    const reasonValidation = validateString(data.reason, "Razón de extensión", {
      required: false,
      maxLength: 200,
    });
    if (!reasonValidation.valid) {
      errors.reason = reasonValidation.error;
    } else {
      validatedData.reason = reasonValidation.value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Middleware para validar permisos de préstamo según rol
const requireLoanPermissions = (action) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(createValidationError("Usuario no autenticado"));
    }

    const userRole = req.user.role;
    let hasPermission = false;

    switch (action) {
      case "process_loans":
        hasPermission = canUserPerformAction(userRole, "can_process_loans");
        break;
      case "process_returns":
        hasPermission = canUserPerformAction(userRole, "can_process_returns");
        break;
      case "extend_loans":
        hasPermission = canUserPerformAction(userRole, "can_extend_loans");
        break;
      case "access_all_loans":
        hasPermission = canUserPerformAction(userRole, "can_access_all_loans");
        break;
      case "generate_reports":
        hasPermission = canUserPerformAction(userRole, "can_generate_reports");
        break;
      case "view_own_loans":
        hasPermission = canUserPerformAction(userRole, "can_view_own_loans");
        break;
      default:
        hasPermission = false;
    }

    if (!hasPermission) {
      logger.security(
        "Loan permission denied",
        {
          user_id: req.user.id,
          user_role: userRole,
          required_permission: action,
          url: req.originalUrl,
          method: req.method,
        },
        req
      );

      return res.forbidden(`No tienes permisos para: ${action}`);
    }

    next();
  });
};

// Middleware para verificar que el usuario puede acceder a un préstamo específico
const requireLoanAccess = asyncHandler(async (req, res, next) => {
  const loanId = req.params.id || req.params.loanId;
  if (!loanId) {
    return res.validationError({ loan_id: "ID de préstamo requerido" });
  }

  // Admin y librarian pueden acceder a cualquier préstamo
  if (req.user.role === "admin" || req.user.role === "librarian") {
    return next();
  }

  // Usuarios normales solo pueden acceder a sus propios préstamos
  // Esta verificación se hará en el controlador ya que necesita consulta a BD
  next();
});

// Middleware para validar que un usuario puede ver préstamos de otro usuario
const requireUserLoanAccess = (req, res, next) => {
  const targetUserId = req.params.user_id || req.params.userId;

  if (!targetUserId) {
    return res.validationError({ user_id: "ID de usuario requerido" });
  }

  // Admin y librarian pueden ver préstamos de cualquier usuario
  if (req.user.role === "admin" || req.user.role === "librarian") {
    return next();
  }

  // Usuario normal solo puede ver sus propios préstamos
  if (parseInt(targetUserId) !== req.user.id) {
    logger.security(
      "Unauthorized access to user loans",
      {
        requesting_user: req.user.id,
        target_user: targetUserId,
        user_role: req.user.role,
      },
      req
    );

    return res.forbidden("Solo puedes acceder a tus propios préstamos");
  }

  next();
};

// Validar rango de fechas para reportes
const validateDateRange = (data) => {
  const errors = {};
  const validatedData = {};

  if (data.start_date) {
    const startDate = new Date(data.start_date);
    if (isNaN(startDate.getTime())) {
      errors.start_date = "Fecha de inicio inválida";
    } else {
      validatedData.start_date = startDate.toISOString().split("T")[0];
    }
  }

  if (data.end_date) {
    const endDate = new Date(data.end_date);
    if (isNaN(endDate.getTime())) {
      errors.end_date = "Fecha final inválida";
    } else {
      validatedData.end_date = endDate.toISOString().split("T")[0];
    }
  }

  // Verificar que start_date <= end_date
  if (validatedData.start_date && validatedData.end_date) {
    if (new Date(validatedData.start_date) > new Date(validatedData.end_date)) {
      errors.date_range =
        "La fecha de inicio debe ser anterior a la fecha final";
    }
  }

  // Verificar que las fechas no sean muy antiguas (opcional)
  if (validatedData.start_date) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (new Date(validatedData.start_date) < oneYearAgo) {
      errors.start_date = "La fecha de inicio no puede ser anterior a un año";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Middleware de validación para búsqueda de préstamos
const validateLoanSearchParams = (req, res, next) => {
  const { status, user_id, book_id, overdue_only, start_date, end_date } =
    req.query;
  const errors = {};

  // Validar status si se proporciona
  if (status) {
    const validStatuses = ["active", "returned", "overdue", "lost"];
    if (!validStatuses.includes(status)) {
      errors.status = `Estado debe ser: ${validStatuses.join(", ")}`;
    }
  }

  // Validar user_id si se proporciona
  if (user_id && isNaN(parseInt(user_id))) {
    errors.user_id = "ID de usuario debe ser un número";
  }

  // Validar book_id si se proporciona
  if (book_id && isNaN(parseInt(book_id))) {
    errors.book_id = "ID de libro debe ser un número";
  }

  // Validar overdue_only
  if (overdue_only && !["true", "false"].includes(overdue_only)) {
    errors.overdue_only = "overdue_only debe ser 'true' o 'false'";
  }

  // Validar fechas
  if (start_date || end_date) {
    const dateValidation = validateDateRange({ start_date, end_date });
    if (!dateValidation.valid) {
      Object.assign(errors, dateValidation.errors);
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.validationError(errors, "Parámetros de búsqueda inválidos");
  }

  next();
};

// Middleware para logging de operaciones de préstamo
const logLoanOperation = (operation) => {
  return (req, res, next) => {
    logger.audit(
      `Loan operation: ${operation}`,
      {
        user_id: req.user.id,
        user_role: req.user.role,
        operation: operation,
        target_data: {
          loan_id: req.params.id,
          user_id: req.body?.user_id || req.params.user_id,
          book_id: req.body?.book_id,
        },
      },
      req
    );

    next();
  };
};

module.exports = {
  validateLoanData,
  validateReturnData,
  validateExtensionData,
  validateDateRange,
  requireLoanPermissions,
  requireLoanAccess,
  requireUserLoanAccess,
  validateLoanSearchParams,
  logLoanOperation,
};
