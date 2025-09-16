import api from "./api";

export const dashboardService = {
  // GET /api/dashboard/user
  getUserDashboard: async () => {
    const response = await api.get("/dashboard/user");
    return response.data;
  },

  // GET /api/dashboard/librarian (staff only)
  getLibrarianDashboard: async () => {
    const response = await api.get("/dashboard/librarian");
    return response.data;
  },

  // GET /api/dashboard/admin (admin only)
  getAdminDashboard: async () => {
    const response = await api.get("/dashboard/admin");
    return response.data;
  },

  // GET /api/dashboard/reports/monthly (admin only)
  getMonthlyReport: async (params = {}) => {
    const response = await api.get("/dashboard/reports/monthly", { params });
    return response.data;
  },

  // GET /api/dashboard/reports/users-activity (admin only)
  getUsersActivityReport: async (params = {}) => {
    const response = await api.get("/dashboard/reports/users-activity", {
      params,
    });
    return response.data;
  },
};
