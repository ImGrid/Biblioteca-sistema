const { USERS_QUERIES } = require("../config/queries");
const { executeQuerySingle, executeQuery } = require("../utils/database");
const {
  hashPassword,
  verifyPassword,
  generateToken,
  createTokenPayload,
  sanitizeUserForResponse,
  validatePasswordStrength,
} = require("../utils/auth");
const {
  validateUserRegistration,
  validateEmail,
  validatePassword,
  validateObject,
  validateName,
  validatePhone,
  validateString,
} = require("../utils/validation");
const {
  createAuthenticationError,
  createValidationError,
  createDuplicateError,
  asyncHandler,
} = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Registro de nuevo usuario (solo role 'user')
const register = asyncHandler(async (req, res) => {
  const validation = validateUserRegistration(req.body);

  if (!validation.valid) {
    return res.validationError(
      validation.errors,
      "Datos de registro inválidos"
    );
  }

  const { email, password, first_name, last_name, phone, address } =
    validation.data;

  // Verificar que el email no existe
  const emailExists = await executeQuerySingle(
    USERS_QUERIES.CHECK_EMAIL_EXISTS,
    [email],
    "Check email exists for registration"
  );

  if (!emailExists.success) {
    logger.error("Database error during email check:", emailExists.error);
    return res.serverError("Error al verificar email");
  }

  if (emailExists.data) {
    logger.security(
      "Registration attempt with existing email",
      {
        email: email,
        ip: req.ip,
      },
      req
    );

    return res.conflict("El email ya está registrado");
  }

  // Validar fuerza de contraseña
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    return res.validationError({ password: passwordValidation.error });
  }

  try {
    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);

    // Crear usuario (siempre con rol 'user' para autoregistro)
    const newUser = await executeQuerySingle(
      USERS_QUERIES.CREATE_USER,
      [email, hashedPassword, first_name, last_name, phone, address, "user"],
      "Create new user registration"
    );

    if (!newUser.success) {
      if (newUser.code === "23505") {
        return res.conflict("El usuario ya existe");
      }

      logger.error("Database error during user creation:", newUser.error);
      return res.serverError("Error al crear usuario");
    }

    const userData = sanitizeUserForResponse(newUser.data);

    logger.audit(
      "User registered successfully",
      {
        new_user_id: userData.id,
        email: userData.email,
      },
      req
    );

    res.created(userData, "Usuario registrado exitosamente");
  } catch (error) {
    logger.error("Registration error:", error.message);
    res.serverError("Error en el proceso de registro");
  }
});

// Inicio de sesión
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validar entrada básica
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);

  if (!emailValidation.valid || !passwordValidation.valid) {
    logger.security(
      "Login attempt with invalid credentials format",
      {
        email: email || "missing",
        has_password: !!password,
        ip: req.ip,
      },
      req
    );

    return res.unauthorized("Credenciales inválidas");
  }

  try {
    // Buscar usuario por email
    const user = await executeQuerySingle(
      USERS_QUERIES.FIND_BY_EMAIL,
      [emailValidation.value],
      "Find user for login"
    );

    if (!user.success || !user.data) {
      logger.security(
        "Login attempt with non-existent email",
        {
          email: emailValidation.value,
          ip: req.ip,
        },
        req
      );

      return res.unauthorized("Credenciales inválidas");
    }

    // Verificar contraseña
    const passwordMatch = await verifyPassword(
      password,
      user.data.password_hash
    );

    if (!passwordMatch) {
      logger.security(
        "Login attempt with wrong password",
        {
          user_id: user.data.id,
          email: emailValidation.value,
          ip: req.ip,
        },
        req
      );

      return res.unauthorized("Credenciales inválidas");
    }

    // Verificar que el usuario esté activo
    if (!user.data.is_active) {
      logger.security(
        "Login attempt with inactive user",
        {
          user_id: user.data.id,
          email: emailValidation.value,
          ip: req.ip,
        },
        req
      );

      return res.unauthorized("Cuenta inactiva");
    }

    // Generar token JWT
    const tokenPayload = createTokenPayload(user.data);
    const token = generateToken(tokenPayload);

    // Actualizar último login
    await executeQuery(
      USERS_QUERIES.UPDATE_LAST_LOGIN,
      [user.data.id],
      "Update last login"
    );

    // Sanitizar datos de usuario para respuesta
    const userData = sanitizeUserForResponse(user.data);

    logger.audit(
      "User login successful",
      {
        user_id: userData.id,
        user_role: userData.role,
      },
      req
    );

    res.authSuccess(token, userData, "Inicio de sesión exitoso");
  } catch (error) {
    logger.error("Login error:", error.message);
    res.serverError("Error en el proceso de autenticación");
  }
});

// Obtener perfil del usuario autenticado
const getProfile = asyncHandler(async (req, res) => {
  try {
    const user = await executeQuerySingle(
      USERS_QUERIES.GET_USER_PROFILE,
      [req.user.id],
      "Get user profile"
    );

    if (!user.success || !user.data) {
      return res.notFound("Usuario");
    }

    const userData = sanitizeUserForResponse(user.data);

    res.success(userData, "Perfil obtenido exitosamente");
  } catch (error) {
    logger.error("Get profile error:", error.message);
    res.serverError("Error al obtener perfil");
  }
});

// Cerrar sesión
const logout = asyncHandler(async (req, res) => {
  // En un sistema más avanzado, aquí se invalidaría el token en una blacklist
  // Por simplicidad, solo registramos el evento

  logger.audit(
    "User logout",
    {
      user_id: req.user.id,
      user_role: req.user.role,
    },
    req
  );

  res.logoutSuccess("Sesión cerrada exitosamente");
});

// Verificar token (para validación del frontend)
const verifyToken = asyncHandler(async (req, res) => {
  // Si llegamos aquí, el token ya fue verificado por el middleware de autenticación
  const userData = sanitizeUserForResponse(req.user);

  res.success(userData, "Token válido");
});

// Actualizar perfil del usuario autenticado
const updateProfile = asyncHandler(async (req, res) => {
  const { first_name, last_name, phone, address } = req.body;

  // CORREGIDO: Validar datos de entrada con imports disponibles
  const validation = validateObject(req.body, {
    first_name: (value) => {
      if (value !== undefined) {
        return validateName(value, "Nombre");
      }
      return { valid: true, value: undefined };
    },
    last_name: (value) => {
      if (value !== undefined) {
        return validateName(value, "Apellido");
      }
      return { valid: true, value: undefined };
    },
    phone: (value) => {
      if (value !== undefined) {
        return validatePhone(value);
      }
      return { valid: true, value: undefined };
    },
    address: (value) => {
      if (value !== undefined) {
        return validateString(value, "Dirección", {
          required: false,
          maxLength: 500,
        });
      }
      return { valid: true, value: undefined };
    },
  });

  if (!validation.valid) {
    return res.validationError(validation.errors, "Datos de perfil inválidos");
  }

  try {
    const updateQuery = `
            UPDATE users 
            SET first_name = COALESCE($1, first_name), 
                last_name = COALESCE($2, last_name), 
                phone = COALESCE($3, phone), 
                address = COALESCE($4, address),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 AND is_active = true
            RETURNING id, email, first_name, last_name, phone, address, role, updated_at
        `;

    const updatedUser = await executeQuerySingle(
      updateQuery,
      [
        validation.data.first_name,
        validation.data.last_name,
        validation.data.phone,
        validation.data.address,
        req.user.id,
      ],
      "Update user profile"
    );

    if (!updatedUser.success) {
      logger.error("Database error during profile update:", updatedUser.error);
      return res.serverError("Error al actualizar perfil");
    }

    if (!updatedUser.data) {
      return res.notFound("Usuario");
    }

    const userData = sanitizeUserForResponse(updatedUser.data);

    logger.audit(
      "Profile updated",
      {
        user_id: req.user.id,
        updated_fields: Object.keys(validation.data).filter(
          (key) => validation.data[key] !== undefined
        ),
      },
      req
    );

    res.success(userData, "Perfil actualizado exitosamente");
  } catch (error) {
    logger.error("Update profile error:", error.message);
    res.serverError("Error al actualizar perfil");
  }
});

// Cambiar contraseña
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.validationError({
      current_password: !current_password
        ? "Contraseña actual requerida"
        : undefined,
      new_password: !new_password ? "Nueva contraseña requerida" : undefined,
    });
  }

  // Validar nueva contraseña
  const passwordValidation = validatePasswordStrength(new_password);
  if (!passwordValidation.valid) {
    return res.validationError({ new_password: passwordValidation.error });
  }

  try {
    // Obtener contraseña actual del usuario
    const user = await executeQuerySingle(
      USERS_QUERIES.FIND_BY_EMAIL,
      [req.user.email],
      "Find user for password change"
    );

    if (!user.success || !user.data) {
      return res.notFound("Usuario");
    }

    // Verificar contraseña actual
    const currentPasswordMatch = await verifyPassword(
      current_password,
      user.data.password_hash
    );

    if (!currentPasswordMatch) {
      logger.security(
        "Password change attempt with wrong current password",
        {
          user_id: req.user.id,
          ip: req.ip,
        },
        req
      );

      return res.validationError({
        current_password: "Contraseña actual incorrecta",
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const samePassword = await verifyPassword(
      new_password,
      user.data.password_hash
    );
    if (samePassword) {
      return res.validationError({
        new_password: "La nueva contraseña debe ser diferente a la actual",
      });
    }

    // Hash de la nueva contraseña
    const hashedNewPassword = await hashPassword(new_password);

    // Actualizar contraseña en la base de datos
    const updateQuery = `
            UPDATE users 
            SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id
        `;

    const result = await executeQuerySingle(
      updateQuery,
      [hashedNewPassword, req.user.id],
      "Update user password"
    );

    if (!result.success) {
      logger.error("Database error during password change:", result.error);
      return res.serverError("Error al cambiar contraseña");
    }

    logger.audit(
      "Password changed successfully",
      {
        user_id: req.user.id,
      },
      req
    );

    res.success(null, "Contraseña cambiada exitosamente");
  } catch (error) {
    logger.error("Change password error:", error.message);
    res.serverError("Error al cambiar contraseña");
  }
});

// Listar roles disponibles (solo para admin)
const getRoles = asyncHandler(async (req, res) => {
  const roles = [
    {
      value: "admin",
      label: "Administrador",
      description: "Control total del sistema",
    },
    {
      value: "librarian",
      label: "Bibliotecario",
      description: "Gestión de préstamos y usuarios",
    },
    {
      value: "user",
      label: "Usuario",
      description: "Acceso básico a servicios",
    },
  ];

  res.success(roles, "Roles obtenidos exitosamente");
});

module.exports = {
  register,
  login,
  logout,
  getProfile,
  verifyToken,
  updateProfile,
  changePassword,
  getRoles,
};
