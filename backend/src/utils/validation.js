// Sistema de validaciones para seguridad de entrada de datos

// Expresiones regulares para validaciones
const REGEX_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  PHONE: /^[+]?[\d\s\-()]{7,15}$/,
  NAME: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]{2,50}$/,
  ISBN: /^(?:ISBN(?:-13)?:?\s?)?(?=[-0-9\sX]{10,17}$)(?:97[89][-\s]?)?[-0-9\sX]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9\s]+$/,
  SQL_INJECTION:
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|([';\"\\])/gi,
  XSS_BASIC: /<[^>]*script[^>]*>|javascript:|on\w+\s*=/gi,
};

// Límites de longitud para campos
const LENGTH_LIMITS = {
  EMAIL: { min: 5, max: 255 },
  PASSWORD: { min: 8, max: 128 },
  NAME: { min: 2, max: 100 },
  TITLE: { min: 1, max: 255 },
  DESCRIPTION: { min: 0, max: 1000 },
  ADDRESS: { min: 10, max: 500 },
  PHONE: { min: 7, max: 20 },
  ISBN: { min: 10, max: 17 },
};

// Validar email
const validateEmail = (email) => {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email es requerido y debe ser texto" };
  }

  const trimmed = email.trim().toLowerCase();

  if (
    trimmed.length < LENGTH_LIMITS.EMAIL.min ||
    trimmed.length > LENGTH_LIMITS.EMAIL.max
  ) {
    return {
      valid: false,
      error: `Email debe tener entre ${LENGTH_LIMITS.EMAIL.min} y ${LENGTH_LIMITS.EMAIL.max} caracteres`,
    };
  }

  if (!REGEX_PATTERNS.EMAIL.test(trimmed)) {
    return { valid: false, error: "Formato de email inválido" };
  }

  return { valid: true, value: trimmed };
};

// Validar contraseña
const validatePassword = (password) => {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Contraseña es requerida" };
  }

  if (
    password.length < LENGTH_LIMITS.PASSWORD.min ||
    password.length > LENGTH_LIMITS.PASSWORD.max
  ) {
    return {
      valid: false,
      error: `Contraseña debe tener entre ${LENGTH_LIMITS.PASSWORD.min} y ${LENGTH_LIMITS.PASSWORD.max} caracteres`,
    };
  }

  if (!REGEX_PATTERNS.PASSWORD.test(password)) {
    return {
      valid: false,
      error:
        "Contraseña debe tener al menos: 1 mayúscula, 1 minúscula, 1 número y 8 caracteres",
    };
  }

  return { valid: true, value: password };
};

// Validar nombre (first_name, last_name)
const validateName = (name, fieldName = "Nombre") => {
  if (!name || typeof name !== "string") {
    return { valid: false, error: `${fieldName} es requerido` };
  }

  const trimmed = name.trim();

  if (
    trimmed.length < LENGTH_LIMITS.NAME.min ||
    trimmed.length > LENGTH_LIMITS.NAME.max
  ) {
    return {
      valid: false,
      error: `${fieldName} debe tener entre ${LENGTH_LIMITS.NAME.min} y ${LENGTH_LIMITS.NAME.max} caracteres`,
    };
  }

  if (!REGEX_PATTERNS.NAME.test(trimmed)) {
    return {
      valid: false,
      error: `${fieldName} solo puede contener letras y espacios`,
    };
  }

  return { valid: true, value: trimmed };
};

// Validar teléfono
const validatePhone = (phone) => {
  if (!phone) {
    return { valid: true, value: null }; // Phone es opcional
  }

  if (typeof phone !== "string") {
    return { valid: false, error: "Teléfono debe ser texto" };
  }

  const trimmed = phone.trim();

  if (
    trimmed.length < LENGTH_LIMITS.PHONE.min ||
    trimmed.length > LENGTH_LIMITS.PHONE.max
  ) {
    return {
      valid: false,
      error: `Teléfono debe tener entre ${LENGTH_LIMITS.PHONE.min} y ${LENGTH_LIMITS.PHONE.max} caracteres`,
    };
  }

  if (!REGEX_PATTERNS.PHONE.test(trimmed)) {
    return { valid: false, error: "Formato de teléfono inválido" };
  }

  return { valid: true, value: trimmed };
};

// Validar ISBN
const validateISBN = (isbn) => {
  if (!isbn) {
    return { valid: true, value: null }; // ISBN es opcional
  }

  if (typeof isbn !== "string") {
    return { valid: false, error: "ISBN debe ser texto" };
  }

  const trimmed = isbn.trim().replace(/[-\s]/g, ""); // Remover guiones y espacios

  if (
    trimmed.length < LENGTH_LIMITS.ISBN.min ||
    trimmed.length > LENGTH_LIMITS.ISBN.max
  ) {
    return { valid: false, error: "Longitud de ISBN inválida" };
  }

  if (!REGEX_PATTERNS.ISBN.test(isbn)) {
    return { valid: false, error: "Formato de ISBN inválido" };
  }

  return { valid: true, value: isbn.trim() };
};

// Validar rol de usuario
const validateRole = (role) => {
  const validRoles = ["admin", "librarian", "user"];

  if (!role || typeof role !== "string") {
    return { valid: false, error: "Rol es requerido" };
  }

  const trimmed = role.trim().toLowerCase();

  if (!validRoles.includes(trimmed)) {
    return {
      valid: false,
      error: `Rol debe ser uno de: ${validRoles.join(", ")}`,
    };
  }

  return { valid: true, value: trimmed };
};

// Validar ID (números enteros positivos)
const validateId = (id, fieldName = "ID") => {
  if (id === null || id === undefined) {
    return { valid: false, error: `${fieldName} es requerido` };
  }

  const numId = parseInt(id, 10);

  if (isNaN(numId) || numId <= 0) {
    return {
      valid: false,
      error: `${fieldName} debe ser un número entero positivo`,
    };
  }

  return { valid: true, value: numId };
};

// Validar cadena de texto general
const validateString = (value, fieldName, options = {}) => {
  const {
    required = true,
    minLength = 1,
    maxLength = 255,
    allowEmpty = false,
  } = options;

  if (!value || typeof value !== "string") {
    if (required) {
      return { valid: false, error: `${fieldName} es requerido` };
    }
    return { valid: true, value: null };
  }

  const trimmed = value.trim();

  if (!allowEmpty && trimmed.length === 0 && required) {
    return { valid: false, error: `${fieldName} no puede estar vacío` };
  }

  if (trimmed.length < minLength || trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} debe tener entre ${minLength} y ${maxLength} caracteres`,
    };
  }

  return { valid: true, value: trimmed };
};

// Validar número entero
const validateInteger = (value, fieldName, options = {}) => {
  const { required = true, min = null, max = null } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { valid: false, error: `${fieldName} es requerido` };
    }
    return { valid: true, value: null };
  }

  const numValue = parseInt(value, 10);

  if (isNaN(numValue)) {
    return { valid: false, error: `${fieldName} debe ser un número entero` };
  }

  if (min !== null && numValue < min) {
    return {
      valid: false,
      error: `${fieldName} debe ser mayor o igual a ${min}`,
    };
  }

  if (max !== null && numValue > max) {
    return {
      valid: false,
      error: `${fieldName} debe ser menor o igual a ${max}`,
    };
  }

  return { valid: true, value: numValue };
};

// Sanitizar entrada para prevenir XSS
const sanitizeInput = (input) => {
  if (!input || typeof input !== "string") {
    return input;
  }

  return input
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

// Detectar intentos de SQL injection
const detectSQLInjection = (input) => {
  if (!input || typeof input !== "string") {
    return { detected: false };
  }

  const matches = input.match(REGEX_PATTERNS.SQL_INJECTION);

  if (matches) {
    return {
      detected: true,
      patterns: matches,
      error: "Entrada contiene patrones de SQL injection",
    };
  }

  return { detected: false };
};

// Detectar intentos de XSS
const detectXSS = (input) => {
  if (!input || typeof input !== "string") {
    return { detected: false };
  }

  const matches = input.match(REGEX_PATTERNS.XSS_BASIC);

  if (matches) {
    return {
      detected: true,
      patterns: matches,
      error: "Entrada contiene patrones de XSS",
    };
  }

  return { detected: false };
};

// Validar objeto completo
const validateObject = (obj, validationRules) => {
  const errors = {};
  const validatedData = {};

  Object.entries(validationRules).forEach(([field, validator]) => {
    const value = obj[field];
    const result = validator(value);

    if (!result.valid) {
      errors[field] = result.error;
    } else {
      validatedData[field] = result.value;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validatedData,
  };
};

// Validaciones específicas para modelos
const validateUserRegistration = (userData) => {
  return validateObject(userData, {
    email: validateEmail,
    password: validatePassword,
    first_name: (value) => validateName(value, "Nombre"),
    last_name: (value) => validateName(value, "Apellido"),
    phone: validatePhone,
    role: validateRole,
  });
};

const validateBookData = (bookData) => {
  return validateObject(bookData, {
    title: (value) =>
      validateString(value, "Título", { maxLength: LENGTH_LIMITS.TITLE.max }),
    isbn: validateISBN,
    publisher: (value) =>
      validateString(value, "Editorial", { required: false, maxLength: 200 }),
    publication_year: (value) =>
      validateInteger(value, "Año de publicación", {
        required: false,
        min: 1000,
        max: new Date().getFullYear() + 1,
      }),
    category_id: (value) => validateId(value, "Categoría"),
    total_copies: (value) =>
      validateInteger(value, "Total de copias", { min: 1, max: 1000 }),
    available_copies: (value) =>
      validateInteger(value, "Copias disponibles", {
        required: false,
        min: 0,
        max: 1000,
      }),
    location: (value) =>
      validateString(value, "Ubicación", {
        required: false,
        maxLength: 50,
      }),
    description: (value) =>
      validateString(value, "Descripción", {
        required: false,
        maxLength: LENGTH_LIMITS.DESCRIPTION.max,
      }),
    author_ids: (value) => {
      if (!value || !Array.isArray(value)) {
        return { valid: false, error: "Debe especificar al menos un autor" };
      }

      if (value.length === 0) {
        return { valid: false, error: "Debe especificar al menos un autor" };
      }

      for (const id of value) {
        const idValidation = validateId(id, "ID de autor");
        if (!idValidation.valid) {
          return {
            valid: false,
            error: `ID de autor inválido: ${idValidation.error}`,
          };
        }
      }

      return { valid: true, value };
    },
  });
};

// Validar parámetros de paginación
const validatePagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;

  const validatedPage = Math.max(1, page);
  const validatedLimit = Math.min(Math.max(1, limit), 100); // Máximo 100 items por página

  return {
    page: validatedPage,
    limit: validatedLimit,
  };
};

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  validateISBN,
  validateRole,
  validateId,
  validateString,
  validateInteger,
  sanitizeInput,
  detectSQLInjection,
  detectXSS,
  validateObject,
  validateUserRegistration,
  validateBookData,
  validatePagination,
  LENGTH_LIMITS,
  REGEX_PATTERNS,
};
