export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Roles de usuario
export const USER_ROLES = {
  ADMIN: "admin",
  LIBRARIAN: "librarian",
  USER: "user",
};

// Estados de préstamos
export const LOAN_STATUS = {
  ACTIVE: "active",
  RETURNED: "returned",
  OVERDUE: "overdue",
  LOST: "lost",
};

// Rutas de la aplicación
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
  BOOKS: "/books",
  LOANS: "/loans",
  FINES: "/fines",
  AUTHORS: "/authors",
  CATEGORIES: "/categories",
  USERS: "/users",
  REPORTS: "/reports",
};

// Configuración de paginación
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
};
