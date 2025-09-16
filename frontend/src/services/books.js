import api from "./api";

export const booksService = {
  // GET /api/books/search
  searchBooks: async (params = {}) => {
    const response = await api.get("/books/search", { params });
    return response.data;
  },

  // GET /api/books/:id
  getBook: async (id) => {
    const response = await api.get(`/books/${id}`);
    return response.data;
  },

  // GET /api/books (admin/librarian only)
  getAllBooks: async (params = {}) => {
    const response = await api.get("/books", { params });
    return response.data;
  },

  // POST /api/books (admin only)
  createBook: async (bookData) => {
    const response = await api.post("/books", bookData);
    return response.data;
  },

  // PUT /api/books/:id (admin only)
  updateBook: async (id, bookData) => {
    const response = await api.put(`/books/${id}`, bookData);
    return response.data;
  },

  // DELETE /api/books/:id (admin only)
  deleteBook: async (id) => {
    const response = await api.delete(`/books/${id}`);
    return response.data;
  },
};
