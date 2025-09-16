import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { NotificationProvider } from "../context/NotificationContext";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import Layout from "../components/layout/Layout";

// Auth Pages
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ProfilePage from "../pages/auth/ProfilePage";

// Dashboard
import DashboardPage from "../pages/dashboard/DashboardPage";

// Books
import BookCatalogPage from "../pages/books/BookCatalogPage";
import BooksManagementPage from "../pages/books/BooksManagementPage";

// Loans
import MyLoansPage from "../pages/loans/MyLoansPage";
import { LoansManagementPage } from "../pages/loans/LoansManagementPage";

// Fines
import MyFinesPage from "../pages/fines/MyFinesPage";
import { FinesManagementPage } from "../pages/fines/FinesManagementPage";

// Admin Pages
import { AuthorsManagementPage } from "../pages/authors/AuthorsManagementPage";
import { CategoriesManagementPage } from "../pages/categories/CategoriesManagementPage";
import { UsersManagementPage } from "../pages/users/UsersManagementPage";
import { ReportsPage } from "../pages/reports/ReportsPage";

const AppRouter = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />

            {/* Rutas protegidas con Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard - todos los roles */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute roles={["user", "librarian", "admin"]}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Perfil - todos los roles */}
              <Route
                path="profile"
                element={
                  <ProtectedRoute roles={["user", "librarian", "admin"]}>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Catálogo de libros - todos los roles */}
              <Route
                path="books"
                element={
                  <ProtectedRoute roles={["user", "librarian", "admin"]}>
                    <BookCatalogPage />
                  </ProtectedRoute>
                }
              />

              {/* Mis préstamos - solo usuarios */}
              <Route
                path="my-loans"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <MyLoansPage />
                  </ProtectedRoute>
                }
              />

              {/* Mis multas - solo usuarios */}
              <Route
                path="my-fines"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <MyFinesPage />
                  </ProtectedRoute>
                }
              />

              {/* Gestión de préstamos - staff */}
              <Route
                path="loans"
                element={
                  <ProtectedRoute roles={["librarian", "admin"]}>
                    <LoansManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* Gestión de multas - staff */}
              <Route
                path="fines"
                element={
                  <ProtectedRoute roles={["librarian", "admin"]}>
                    <FinesManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* Gestión de catálogo - solo admin */}
              <Route
                path="admin/books"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <BooksManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="admin/authors"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AuthorsManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="admin/categories"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <CategoriesManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="admin/users"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <UsersManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="admin/reports"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />

              {/* Ruta 404 para rutas protegidas */}
              <Route
                path="*"
                element={
                  <div className="text-center p-8">
                    <h1 className="text-2xl font-bold">
                      404 - Página no encontrada
                    </h1>
                  </div>
                }
              />
            </Route>

            {/* Ruta 404 general */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold">
                      404 - Página no encontrada
                    </h1>
                    <a
                      href="/login"
                      className="text-blue-500 hover:underline mt-2 inline-block"
                    >
                      Ir a Login
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRouter;
