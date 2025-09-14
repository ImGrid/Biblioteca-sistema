const {
  validateString,
  validateInteger,
  validateId,
} = require("../utils/validation");
const { canUserPerformAction } = require("../utils/businessRules");
const { asyncHandler, createValidationError } = require("./errorHandler");
const logger = require("../utils/logger");

// Validar datos para procesamiento de pagos
const validatePaymentData = (data) => {
  const errors = {};
  const validatedData = {};

  // Payment method (requerido)
  const validPaymentMethods = [
    "efectivo",
    "tarjeta",
    "transferencia",
    "cheque",
  ];

  if (!data.payment_method || typeof data.payment_method !== "string") {
    errors.payment_method = "Método de pago es requerido";
  } else if (!validPaymentMethods.includes(data.payment_method.toLowerCase())) {
    errors.payment_method = `Método de pago debe ser: ${validPaymentMethods.join(
      ", "
    )}`;
  } else {
    validatedData.payment_method = data.payment_method.toLowerCase();
  }

  // Amount (opcional para pagos completos, requerido para parciales)
  if (data.amount !== undefined) {
    const amountValidation = validateInteger(data.amount, "Monto del pago", {
      min: 1,
      max: 10000, // Límite máximo razonable
      required: false,
    });
    if (!amountValidation.valid) {
      errors.amount = amountValidation.error;
    } else {
      validatedData.amount = amountValidation.value;
    }
  }

  // Partial payment flag
  if (data.partial_payment !== undefined) {
    if (typeof data.partial_payment !== "boolean") {
      errors.partial_payment =
        "Indicador de pago parcial debe ser verdadero o falso";
    } else {
      validatedData.partial_payment = data.partial_payment;
    }
  }

  // Notes (opcional)
  if (data.notes !== undefined) {
    const notesValidation = validateString(data.notes, "Notas del pago", {
      required: false,
      maxLength: 500,
    });
    if (!notesValidation.valid) {
      errors.notes = notesValidation.error;
    } else {
      validatedData.notes = notesValidation.value;
    }
  }

  // Transaction reference (opcional para transferencias/tarjetas)
  if (data.transaction_reference !== undefined) {
    const refValidation = validateString(
      data.transaction_reference,
      "Referencia de transacción",
      {
        required: false,
        minLength: 4,
        maxLength: 50,
      }
    );
    if (!refValidation.valid) {
      errors.transaction_reference = refValidation.error;
    } else {
      validatedData.transaction_reference = refValidation.value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Validar datos para condonar multa
const validateForgiveData = (data) => {
  const errors = {};
  const validatedData = {};

  // Reason (requerido y detallado)
  const reasonValidation = validateString(data.reason, "Razón para condonar", {
    minLength: 10,
    maxLength: 500,
  });
  if (!reasonValidation.valid) {
    errors.reason = reasonValidation.error;
  } else {
    validatedData.reason = reasonValidation.value;
  }

  // Authorization code (opcional, para casos especiales)
  if (data.authorization_code !== undefined) {
    const authValidation = validateString(
      data.authorization_code,
      "Código de autorización",
      {
        required: false,
        minLength: 6,
        maxLength: 20,
      }
    );
    if (!authValidation.valid) {
      errors.authorization_code = authValidation.error;
    } else {
      validatedData.authorization_code = authValidation.value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Validar datos para reportes financieros
const validateReportData = (data) => {
  const errors = {};
  const validatedData = {};

  // Period
  const validPeriods = ["daily", "weekly", "monthly", "yearly"];
  if (data.period && !validPeriods.includes(data.period)) {
    errors.period = `Período debe ser: ${validPeriods.join(", ")}`;
  } else {
    validatedData.period = data.period || "monthly";
  }

  // Start date
  if (data.start_date) {
    const startDate = new Date(data.start_date);
    if (isNaN(startDate.getTime())) {
      errors.start_date = "Fecha de inicio inválida";
    } else {
      validatedData.start_date = data.start_date;
    }
  }

  // End date
  if (data.end_date) {
    const endDate = new Date(data.end_date);
    if (isNaN(endDate.getTime())) {
      errors.end_date = "Fecha final inválida";
    } else {
      validatedData.end_date = data.end_date;
    }
  }

  // Verificar que start_date <= end_date
  if (validatedData.start_date && validatedData.end_date) {
    if (new Date(validatedData.start_date) > new Date(validatedData.end_date)) {
      errors.date_range =
        "La fecha de inicio debe ser anterior a la fecha final";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Middleware para verificar permisos específicos de pagos y multas
const requirePaymentPermissions = (action) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(createValidationError("Usuario no autenticado"));
    }

    const userRole = req.user.role;
    let hasPermission = false;

    switch (action) {
      case "process_payments":
        hasPermission = ["admin", "librarian"].includes(userRole);
        break;
      case "view_all_fines":
        hasPermission = ["admin", "librarian"].includes(userRole);
        break;
      case "generate_fines":
        hasPermission = userRole === "admin";
        break;
      case "forgive_fines":
        hasPermission = userRole === "admin";
        break;
      case "view_user_fines":
        hasPermission = ["admin", "librarian"].includes(userRole);
        break;
      case "view_own_fines":
        hasPermission = true; // Todos los usuarios autenticados
        break;
      case "view_financial_reports":
        hasPermission = userRole === "admin";
        break;
      default:
        hasPermission = false;
    }

    if (!hasPermission) {
      logger.security(
        "Payment permission denied",
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

// Middleware para verificar acceso a multas específicas
const requireFineAccess = asyncHandler(async (req, res, next) => {
  const fineId = req.params.id || req.params.fineId;

  if (!fineId) {
    return res.validationError({ fine_id: "ID de multa requerido" });
  }

  // Validar ID de multa
  const fineIdValidation = validateId(fineId, "ID de multa");
  if (!fineIdValidation.valid) {
    return res.validationError({ fine_id: fineIdValidation.error });
  }

  // Admin y librarian pueden acceder a cualquier multa
  if (req.user.role === "admin" || req.user.role === "librarian") {
    return next();
  }

  // Usuarios normales solo pueden acceder a sus propias multas
  // Esta verificación adicional se hace en el controlador con query a BD
  next();
});

// Middleware para verificar límites de montos de pago
const validatePaymentLimits = asyncHandler(async (req, res, next) => {
  const { amount, payment_method } = req.body;

  // Límites por método de pago
  const paymentLimits = {
    efectivo: { min: 1, max: 5000 },
    tarjeta: { min: 1, max: 10000 },
    transferencia: { min: 1, max: 50000 },
    cheque: { min: 100, max: 20000 },
  };

  if (amount && payment_method) {
    const limits = paymentLimits[payment_method.toLowerCase()];

    if (limits) {
      if (amount < limits.min || amount > limits.max) {
        return res.validationError({
          amount: `Para ${payment_method}, el monto debe estar entre $${limits.min} y $${limits.max}`,
        });
      }
    }
  }

  next();
});

// Middleware para logging de operaciones de pago
const logPaymentOperation = (operation) => {
  return (req, res, next) => {
    logger.audit(
      `Payment operation: ${operation}`,
      {
        user_id: req.user.id,
        user_role: req.user.role,
        operation: operation,
        target_data: {
          fine_id: req.params.id,
          user_id: req.params.user_id,
          payment_method: req.body?.payment_method,
          amount: req.body?.amount,
        },
      },
      req
    );

    next();
  };
};

// Middleware para verificar integridad de transacciones
const validateTransactionIntegrity = asyncHandler(async (req, res, next) => {
  const { amount, payment_method, transaction_reference } = req.body;

  // Para métodos electrónicos, requerir referencia
  const electronicMethods = ["tarjeta", "transferencia"];

  if (electronicMethods.includes(payment_method?.toLowerCase())) {
    if (!transaction_reference) {
      return res.validationError({
        transaction_reference: `Para ${payment_method} se requiere referencia de transacción`,
      });
    }
  }

  // Verificar que no exista referencia duplicada (para métodos electrónicos)
  if (transaction_reference) {
    const { executeQuerySingle } = require("../utils/database");

    const existingPayment = await executeQuerySingle(
      "SELECT id FROM fines WHERE reason LIKE $1 AND is_paid = TRUE",
      [`%Ref: ${transaction_reference}%`],
      "Check duplicate transaction reference"
    );

    if (existingPayment.success && existingPayment.data) {
      return res.validationError({
        transaction_reference:
          "Esta referencia de transacción ya fue utilizada",
      });
    }
  }

  next();
});

// Middleware para verificar horarios de operación (opcional)
const checkOperatingHours = (req, res, next) => {
  // Solo aplicar en producción o si está configurado
  if (
    process.env.NODE_ENV !== "production" ||
    !process.env.ENFORCE_OPERATING_HOURS
  ) {
    return next();
  }

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = domingo, 6 = sábado

  // Horarios de operación: Lunes a Viernes 8:00 - 18:00, Sábados 9:00 - 14:00
  const isWeekday = day >= 1 && day <= 5;
  const isSaturday = day === 6;
  const isSunday = day === 0;

  let isOperatingHours = false;

  if (isWeekday && hour >= 8 && hour < 18) {
    isOperatingHours = true;
  } else if (isSaturday && hour >= 9 && hour < 14) {
    isOperatingHours = true;
  }

  if (!isOperatingHours && !isSunday) {
    logger.security(
      "Payment operation outside operating hours",
      {
        user_id: req.user.id,
        current_time: now.toISOString(),
        operation: req.originalUrl,
      },
      req
    );

    return res.validationError({
      operating_hours:
        "Operaciones de pago solo están disponibles en horarios de oficina",
    });
  }

  next();
};

module.exports = {
  validatePaymentData,
  validateForgiveData,
  validateReportData,
  requirePaymentPermissions,
  requireFineAccess,
  validatePaymentLimits,
  logPaymentOperation,
  validateTransactionIntegrity,
  checkOperatingHours,
};
