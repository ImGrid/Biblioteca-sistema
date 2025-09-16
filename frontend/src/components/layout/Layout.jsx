// src/components/layout/Layout.jsx
import React from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Button from "../common/Button";

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  const userNavigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Catálogo", href: "/books" },
    { name: "Mis Préstamos", href: "/my-loans" },
    { name: "Mis Multas", href: "/my-fines" },
  ];

  const librarianNavigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Catálogo", href: "/books" },
    { name: "Préstamos", href: "/loans" },
    { name: "Multas", href: "/fines" },
  ];

  const adminNavigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Catálogo", href: "/books" },
    { name: "Préstamos", href: "/loans" },
    { name: "Multas", href: "/fines" },
    { name: "Libros", href: "/admin/books" },
    { name: "Autores", href: "/admin/authors" },
    { name: "Categorías", href: "/admin/categories" },
    { name: "Usuarios", href: "/admin/users" },
    { name: "Reportes", href: "/admin/reports" },
  ];

  const getNavigation = () => {
    if (user?.role === "admin") return adminNavigation;
    if (user?.role === "librarian") return librarianNavigation;
    return userNavigation;
  };

  const navigation = getNavigation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 mx-auto max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="text-xl font-bold text-gray-900">
                Sistema Biblioteca
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.first_name} {user?.last_name}
              </span>
              <Link to="/profile">
                <Button size="sm" variant="outline">
                  Perfil
                </Button>
              </Link>
              <Button size="sm" onClick={handleLogout}>
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 mx-auto max-w-7xl">
        <div className="flex">
          {/* Sidebar */}
          <nav className="w-64 mr-8">
            <div className="p-4 bg-white border rounded-lg">
              <h3 className="mb-3 text-sm font-medium text-gray-900">
                Navegación
              </h3>
              <ul className="space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`block px-3 py-2 text-sm rounded-md ${
                        isActive(item.href)
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
