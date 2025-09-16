import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para requests - agregar token automáticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para responses - manejar errores globales
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Token expirado o inválido
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    // Forbidden
    if (error.response?.status === 403) {
      console.error("Acceso denegado");
    }

    return Promise.reject(error);
  }
);

export default api;
