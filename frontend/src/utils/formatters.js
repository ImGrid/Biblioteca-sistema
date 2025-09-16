// Formateo de fechas
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Fecha inválida";

  const defaultOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/La_Paz", // Bolivia timezone
    ...options,
  };

  try {
    return date.toLocaleDateString("es-ES", defaultOptions);
  } catch (error) {
    return date.toLocaleDateString();
  }
};

// Formateo de fecha y hora
export const formatDateTime = (dateString, options = {}) => {
  if (!dateString) return "";

  const defaultOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/La_Paz",
    ...options,
  };

  return formatDate(dateString, defaultOptions);
};

// Formateo de fecha relativa (hace X días, etc.)
export const formatRelativeDate = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Hace un momento";
  if (diffInSeconds < 3600)
    return `Hace ${Math.floor(diffInSeconds / 60)} minutos`;
  if (diffInSeconds < 86400)
    return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
  if (diffInSeconds < 2592000)
    return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
  if (diffInSeconds < 31536000)
    return `Hace ${Math.floor(diffInSeconds / 2592000)} meses`;

  return `Hace ${Math.floor(diffInSeconds / 31536000)} años`;
};

// Formateo de moneda
export const formatCurrency = (amount, currency = "BOB", locale = "es-BO") => {
  if (amount === null || amount === undefined) return "$0.00";

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return "$0.00";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
    }).format(numAmount);
  } catch (error) {
    // Fallback si no se puede usar Intl
    return `$${numAmount.toFixed(2)}`;
  }
};

// Formateo de números
export const formatNumber = (number, locale = "es-BO") => {
  if (number === null || number === undefined) return "0";

  const num = parseFloat(number);
  if (isNaN(num)) return "0";

  try {
    return new Intl.NumberFormat(locale).format(num);
  } catch (error) {
    return num.toString();
  }
};

// Calcular días desde una fecha
export const daysSince = (dateString) => {
  if (!dateString) return 0;

  const date = new Date(dateString);
  const now = new Date();
  const diffInTime = now - date;
  const diffInDays = Math.floor(diffInTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffInDays);
};

// Calcular días hasta una fecha
export const daysUntil = (dateString) => {
  if (!dateString) return 0;

  const date = new Date(dateString);
  const now = new Date();
  const diffInTime = date - now;
  const diffInDays = Math.floor(diffInTime / (1000 * 60 * 60 * 24));

  return diffInDays;
};

// Formatear duración en días
export const formatDuration = (days) => {
  if (!days || days < 0) return "0 días";

  if (days === 1) return "1 día";
  if (days < 7) return `${days} días`;

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (weeks === 1 && remainingDays === 0) return "1 semana";
  if (weeks === 1)
    return `1 semana y ${remainingDays} día${remainingDays > 1 ? "s" : ""}`;
  if (remainingDays === 0) return `${weeks} semanas`;

  return `${weeks} semanas y ${remainingDays} día${
    remainingDays > 1 ? "s" : ""
  }`;
};

// Formatear estado de préstamo
export const formatLoanStatus = (loan) => {
  if (!loan) return { text: "Desconocido", className: "text-gray-500" };

  const { status, due_date, return_date } = loan;

  if (status === "returned" || return_date) {
    return {
      text: "Devuelto",
      className: "text-green-600",
      badge: "bg-green-100 text-green-800",
    };
  }

  if (status === "lost") {
    return {
      text: "Perdido",
      className: "text-red-600",
      badge: "bg-red-100 text-red-800",
    };
  }

  const daysLeft = daysUntil(due_date);

  if (daysLeft < 0) {
    return {
      text: `Vencido (${Math.abs(daysLeft)} días)`,
      className: "text-red-600",
      badge: "bg-red-100 text-red-800",
    };
  }

  if (daysLeft === 0) {
    return {
      text: "Vence hoy",
      className: "text-orange-600",
      badge: "bg-orange-100 text-orange-800",
    };
  }

  if (daysLeft <= 3) {
    return {
      text: `Vence en ${daysLeft} día${daysLeft > 1 ? "s" : ""}`,
      className: "text-yellow-600",
      badge: "bg-yellow-100 text-yellow-800",
    };
  }

  return {
    text: "Activo",
    className: "text-blue-600",
    badge: "bg-blue-100 text-blue-800",
  };
};

// Truncar texto
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

// Formatear nombre completo
export const formatFullName = (firstName, lastName) => {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.join(" ") || "Sin nombre";
};

// Formatear iniciales
export const getInitials = (firstName, lastName) => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : "";
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return first + last || "?";
};

// Formatear teléfono
export const formatPhone = (phone) => {
  if (!phone) return "";

  // Remover caracteres no numéricos
  const cleaned = phone.replace(/\D/g, "");

  // Formato boliviano típico: +591 X XXX XXXX
  if (cleaned.length === 8) {
    return cleaned.replace(/(\d{1})(\d{3})(\d{4})/, "$1 $2 $3");
  }

  if (cleaned.length === 11 && cleaned.startsWith("591")) {
    return cleaned.replace(/(\d{3})(\d{1})(\d{3})(\d{4})/, "+$1 $2 $3 $4");
  }

  return phone; // Devolver original si no coincide con formato esperado
};

// Formatear porcentaje
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined) return "0%";

  const num = parseFloat(value);
  if (isNaN(num)) return "0%";

  return `${num.toFixed(decimals)}%`;
};

// Formatear tamaño de archivo
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Capitalizar primera letra
export const capitalize = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Formatear texto a título (Title Case)
export const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => capitalize(word))
    .join(" ");
};

// Validar si una fecha está en el futuro
export const isFutureDate = (dateString) => {
  if (!dateString) return false;
  return new Date(dateString) > new Date();
};

// Validar si una fecha está en el pasado
export const isPastDate = (dateString) => {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
};

// Obtener rango de fechas legible
export const getDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "";

  const start = formatDate(startDate, { month: "short", day: "numeric" });
  const end = formatDate(endDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${start} - ${end}`;
};

// Formatear estado de usuario
export const formatUserStatus = (user) => {
  if (!user) return { text: "Desconocido", className: "text-gray-500" };

  if (!user.is_active) {
    return {
      text: "Inactivo",
      className: "text-gray-600",
      badge: "bg-gray-100 text-gray-800",
    };
  }

  // Lógica adicional basada en last_login, etc.
  return {
    text: "Activo",
    className: "text-green-600",
    badge: "bg-green-100 text-green-800",
  };
};
