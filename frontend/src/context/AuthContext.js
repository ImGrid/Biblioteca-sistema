import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/auth";
import { USER_ROLES } from "../utils/constants";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar token al cargar la aplicación
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);

          // Verificar que el token sigue siendo válido
          await authService.verifyToken();
        } catch (error) {
          console.error("Token inválido:", error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Login
  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);

      if (response.success && response.data.token) {
        const { token: newToken, user: userData } = response.data;

        // Guardar en localStorage
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(userData));

        // Actualizar estado
        setToken(newToken);
        setUser(userData);
        setIsAuthenticated(true);

        return { success: true, user: userData };
      }

      return { success: false, error: response.message || "Error en login" };
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage =
        error.response?.data?.error?.message || "Error de conexión";
      return { success: false, error: errorMessage };
    }
  };

  // Register
  const register = async (userData) => {
    try {
      const response = await authService.register(userData);

      if (response.success) {
        return { success: true, message: response.message };
      }

      return { success: false, error: response.message || "Error en registro" };
    } catch (error) {
      console.error("Register error:", error);
      const errorMessage =
        error.response?.data?.error?.message || "Error de conexión";
      const validationErrors = error.response?.data?.error?.details;

      return {
        success: false,
        error: errorMessage,
        validationErrors,
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Limpiar todo independientemente de si la API falló
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Actualizar perfil
  const updateProfile = async (profileData) => {
    try {
      const response = await authService.updateProfile(profileData);

      if (response.success) {
        const updatedUser = response.data;
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      }

      return { success: false, error: response.message };
    } catch (error) {
      console.error("Update profile error:", error);
      const errorMessage =
        error.response?.data?.error?.message || "Error al actualizar perfil";
      return { success: false, error: errorMessage };
    }
  };

  // Verificar si el usuario tiene un rol específico
  const hasRole = (role) => {
    return user?.role === role;
  };

  // Verificar si el usuario tiene alguno de los roles
  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };

  // Verificar si es admin
  const isAdmin = () => {
    return user?.role === USER_ROLES.ADMIN;
  };

  // Verificar si es staff (librarian o admin)
  const isStaff = () => {
    return (
      user?.role === USER_ROLES.LIBRARIAN || user?.role === USER_ROLES.ADMIN
    );
  };

  // Verificar si es usuario normal
  const isUser = () => {
    return user?.role === USER_ROLES.USER;
  };

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    updateProfile,
    hasRole,
    hasAnyRole,
    isAdmin,
    isStaff,
    isUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
