const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("./logger");

// Configuración de JWT
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const SALT_ROUNDS = 12;

if (!JWT_SECRET) {
  logger.error("JWT_SECRET no está configurado en las variables de entorno");
  process.exit(1);
}

// Hash de contraseñas con bcrypt
const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    logger.error("Error al hashear contraseña:", error.message);
    throw new Error("Error al procesar contraseña");
  }
};

// Verificar contraseña
const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    logger.error("Error al verificar contraseña:", error.message);
    throw new Error("Error al verificar contraseña");
  }
};

// Generar token JWT
const generateToken = (payload) => {
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: "biblioteca-api",
      audience: "biblioteca-users",
    });

    return token;
  } catch (error) {
    logger.error("Error al generar token JWT:", error.message);
    throw new Error("Error al generar token");
  }
};

// Verificar token JWT
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "biblioteca-api",
      audience: "biblioteca-users",
    });

    return { valid: true, payload: decoded };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { valid: false, error: "Token expirado" };
    } else if (error.name === "JsonWebTokenError") {
      return { valid: false, error: "Token inválido" };
    } else {
      logger.error("Error al verificar token JWT:", error.message);
      return { valid: false, error: "Error al verificar token" };
    }
  }
};

// Extraer token del header Authorization
const extractTokenFromHeader = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

// Generar payload para token JWT
const createTokenPayload = (user) => {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    iat: Math.floor(Date.now() / 1000),
  };
};

// Verificar si un rol tiene permisos suficientes
const hasPermission = (userRole, requiredRole) => {
  const roleHierarchy = {
    admin: 3,
    librarian: 2,
    user: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Verificar si un usuario puede acceder a un recurso específico
const canAccessResource = (user, resource, action = "read") => {
  const permissions = {
    admin: {
      users: ["create", "read", "update", "delete"],
      books: ["create", "read", "update", "delete"],
      authors: ["create", "read", "update", "delete"],
      categories: ["create", "read", "update", "delete"],
      loans: ["create", "read", "update", "delete"],
      fines: ["create", "read", "update", "delete"],
      reports: ["read"],
      audit: ["read"],
    },
    librarian: {
      users: ["read"],
      books: ["read"],
      authors: ["read"],
      categories: ["read"],
      loans: ["create", "read", "update"],
      fines: ["create", "read", "update"],
      reports: ["read"],
    },
    user: {
      books: ["read"],
      authors: ["read"],
      categories: ["read"],
      loans: ["read"],
      fines: ["read"],
    },
  };

  const userPermissions = permissions[user.role];
  if (!userPermissions) {
    return false;
  }

  const resourcePermissions = userPermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
};

// Verificar si un usuario puede acceder a datos de otro usuario
const canAccessUserData = (requestingUser, targetUserId) => {
  // Admin puede acceder a todos los datos
  if (requestingUser.role === "admin") {
    return true;
  }

  // Librarian puede acceder a datos de users
  if (requestingUser.role === "librarian") {
    return true;
  }

  // Users solo pueden acceder a sus propios datos
  return requestingUser.id === parseInt(targetUserId);
};

// Generar hash para reset de password (no implementado en esta fase)
const generatePasswordResetToken = (userId) => {
  try {
    const payload = {
      userId,
      type: "password_reset",
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hora
    };

    return jwt.sign(payload, JWT_SECRET + "reset");
  } catch (error) {
    logger.error("Error al generar token de reset:", error.message);
    throw new Error("Error al generar token de reset");
  }
};

// Verificar token de reset de password
const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET + "reset");

    if (decoded.type !== "password_reset") {
      return { valid: false, error: "Tipo de token inválido" };
    }

    return { valid: true, userId: decoded.userId };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { valid: false, error: "Token de reset expirado" };
    } else {
      return { valid: false, error: "Token de reset inválido" };
    }
  }
};

// Sanitizar datos de usuario para respuesta (remover datos sensibles)
const sanitizeUserForResponse = (user) => {
  const { password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
};

// Validar fuerza de contraseña
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const maxLength = 128;

  if (!password || password.length < minLength) {
    return {
      valid: false,
      error: `Contraseña debe tener al menos ${minLength} caracteres`,
    };
  }

  if (password.length > maxLength) {
    return {
      valid: false,
      error: `Contraseña debe tener máximo ${maxLength} caracteres`,
    };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUpperCase) {
    return {
      valid: false,
      error: "Contraseña debe tener al menos una mayúscula",
    };
  }

  if (!hasLowerCase) {
    return {
      valid: false,
      error: "Contraseña debe tener al menos una minúscula",
    };
  }

  if (!hasNumbers) {
    return { valid: false, error: "Contraseña debe tener al menos un número" };
  }

  // Opcional: requerir caracteres especiales para mayor seguridad
  if (!hasSpecialChar) {
    return {
      valid: false,
      error: "Contraseña debe tener al menos un carácter especial",
    };
  }

  return { valid: true };
};

// Verificar si el token está cerca de expirar (para renovación automática)
const isTokenNearExpiry = (token, minutesThreshold = 30) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const expiryTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;
    const thresholdMs = minutesThreshold * 60 * 1000;

    return timeUntilExpiry <= thresholdMs;
  } catch (error) {
    return true;
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  createTokenPayload,
  hasPermission,
  canAccessResource,
  canAccessUserData,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  sanitizeUserForResponse,
  validatePasswordStrength,
  isTokenNearExpiry,
};
