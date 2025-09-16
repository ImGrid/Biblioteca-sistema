import api from "./api";

export const authorsService = {
  // GET /api/authors
  getAuthors: async (params = {}) => {
    const response = await api.get("/authors", { params });
    return response.data;
  },

  // GET /api/authors/:id
  getAuthor: async (id) => {
    const response = await api.get(`/authors/${id}`);
    return response.data;
  },

  // POST /api/authors (admin only)
  createAuthor: async (authorData) => {
    const response = await api.post("/authors", authorData);
    return response.data;
  },

  // PUT /api/authors/:id (admin only)
  updateAuthor: async (id, authorData) => {
    const response = await api.put(`/authors/${id}`, authorData);
    return response.data;
  },

  // DELETE /api/authors/:id (admin only)
  deleteAuthor: async (id) => {
    const response = await api.delete(`/authors/${id}`);
    return response.data;
  },
};
