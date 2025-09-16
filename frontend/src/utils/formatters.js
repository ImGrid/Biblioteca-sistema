// src/utils/formatters.js

// Formatear fechas
export const formatDate = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Formatear moneda
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "$0.00";

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0.00";

  return `$${num.toFixed(2)}`;
};

// Calcular días desde una fecha
export const daysSince = (dateString) => {
  if (!dateString) return 0;

  const date = new Date(dateString);
  const today = new Date();
  if (isNaN(date.getTime())) return 0;

  const diffTime = today - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
};

// Calcular días hasta una fecha
export const daysUntil = (dateString) => {
  if (!dateString) return 0;

  const date = new Date(dateString);
  const today = new Date();
  if (isNaN(date.getTime())) return 0;

  // Solo comparar fechas, no horas
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = date - today;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};
