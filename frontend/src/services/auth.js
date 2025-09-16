import api from "./api";

export const authService = {
  // POST /api/auth/login
  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    return response.data;
  },

  // POST /api/auth/register
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  // GET /api/auth/me
  getProfile: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  // PUT /api/auth/profile
  updateProfile: async (profileData) => {
    const response = await api.put("/auth/profile", profileData);
    return response.data;
  },

  // PUT /api/auth/password
  changePassword: async (passwordData) => {
    const response = await api.put("/auth/password", passwordData);
    return response.data;
  },

  // POST /api/auth/verify
  verifyToken: async () => {
    const response = await api.post("/auth/verify");
    return response.data;
  },

  // POST /api/auth/logout
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },
};
