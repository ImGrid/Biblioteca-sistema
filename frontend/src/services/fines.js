import api from "./api";

export const finesService = {
  // GET /api/fines/my-fines (user)
  getMyFines: async (params = {}) => {
    const response = await api.get("/fines/my-fines", { params });
    const apiResponse = response.data;

    if (apiResponse.success && apiResponse.data.fines) {
      // Adapt the structure for the generic hook
      return {
        success: true,
        data: apiResponse.data.fines, // Extract the array
        pagination: apiResponse.data.pagination, // Pass pagination along
      };
    }
    
    return apiResponse; // Return original response if not successful or structure is unexpected
  },

  // GET /api/fines/my-history (user)
  getMyHistory: async (params = {}) => {
    const response = await api.get("/fines/my-history", { params });
    return response.data;
  },

  // GET /api/fines/pending (staff only)
  getPendingFines: async (params = {}) => {
    const response = await api.get("/fines/pending", { params });
    return response.data;
  },

  // PUT /api/fines/:id/pay (staff only)
  processPayment: async (fineId, paymentData) => {
    const response = await api.put(`/fines/${fineId}/pay`, paymentData);
    return response.data;
  },

  // PUT /api/fines/:id/forgive (admin only)
  forgiveFine: async (fineId, forgiveData) => {
    const response = await api.put(`/fines/${fineId}/forgive`, forgiveData);
    return response.data;
  },

  // GET /api/fines/user/:user_id (staff only)
  getUserFines: async (userId, params = {}) => {
    const response = await api.get(`/fines/user/${userId}`, { params });
    return response.data;
  },

  // POST /api/fines/generate-overdue (admin only)
  generateOverdueFines: async () => {
    const response = await api.post("/fines/generate-overdue");
    return response.data;
  },
};
