// src/services/categories.js
import api from "./api";

export const categoriesService = {
  // GET /api/categories
  getCategories: async (params = {}) => {
    const response = await api.get("/categories", { params });
    return response.data;
  },

  // GET /api/categories/:id
  getCategory: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  // POST /api/categories (admin only)
  createCategory: async (categoryData) => {
    const response = await api.post("/categories", categoryData);
    return response.data;
  },

  // PUT /api/categories/:id (admin only)
  updateCategory: async (id, categoryData) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  // DELETE /api/categories/:id (admin only)
  deleteCategory: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
};
