import api from "./api";

export const usersService = {
  // GET /api/users/search - Buscar usuarios (para formularios de préstamos)
  searchUsers: async (params = {}) => {
    const response = await api.get("/users/search", { params });
    return response.data;
  },

  // GET /api/users/:id - Obtener usuario por ID con estadísticas básicas
  getUser: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // GET /api/users/:id/stats - Obtener estadísticas detalladas de usuario
  getUserStats: async (id) => {
    const response = await api.get(`/users/${id}/stats`);
    return response.data;
  },

  // GET /api/users - Listar todos los usuarios con paginación (admin only)
  getAllUsers: async (params = {}) => {
    const response = await api.get("/users", { params });
    return response.data;
  },

  // POST /api/users - Crear nuevo usuario (admin only)
  createUser: async (userData) => {
    const response = await api.post("/users", userData);
    return response.data;
  },

  // PUT /api/users/:id - Actualizar usuario (admin only)
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  // PUT /api/users/:id/toggle-status - Activar/Desactivar usuario (admin only)
  toggleUserStatus: async (id) => {
    const response = await api.put(`/users/${id}/toggle-status`);
    return response.data;
  },

  // GET /api/dashboard/reports/users-activity - Reporte de actividad (admin only)
  getUsersActivityReport: async (params = {}) => {
    const response = await api.get("/dashboard/reports/users-activity", {
      params,
    });
    return response.data;
  },

  // GET /api/auth/roles - Obtener roles disponibles (admin only)
  getRoles: async () => {
    const response = await api.get("/auth/roles");
    return response.data;
  },
};
