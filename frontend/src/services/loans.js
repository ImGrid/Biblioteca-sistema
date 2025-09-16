import api from "./api";

export const loansService = {
  // POST /api/loans (staff only)
  createLoan: async (loanData) => {
    const response = await api.post("/loans", loanData);
    return response.data;
  },

  // PUT /api/loans/:id/return (staff only)
  returnLoan: async (loanId, returnData) => {
    const response = await api.put(`/loans/${loanId}/return`, returnData);
    return response.data;
  },

  // PUT /api/loans/:id/extend (staff only)
  extendLoan: async (loanId, extensionData) => {
    const response = await api.put(`/loans/${loanId}/extend`, extensionData);
    return response.data;
  },

  // GET /api/loans/my-loans (user)
  getMyLoans: async (params = {}) => {
    const response = await api.get("/loans/my-loans", { params });
    return response.data;
  },

  // GET /api/loans/my-history (user)
  getMyHistory: async (params = {}) => {
    const response = await api.get("/loans/my-history", { params });
    return response.data;
  },

  // GET /api/loans/active (staff only)
  getActiveLoans: async (params = {}) => {
    const response = await api.get("/loans/active", { params });
    return response.data;
  },

  // GET /api/loans/overdue (staff only)
  getOverdueLoans: async (params = {}) => {
    const response = await api.get("/loans/overdue", { params });
    return response.data;
  },

  // GET /api/loans/user/:user_id (staff only)
  getUserLoans: async (userId, params = {}) => {
    const response = await api.get(`/loans/user/${userId}`, { params });
    return response.data;
  },

  // POST /api/loans/check-eligibility (staff only)
  checkEligibility: async (eligibilityData) => {
    const response = await api.post(
      "/loans/check-eligibility",
      eligibilityData
    );
    return response.data;
  },
};
