// src/pages/auth/LoginPage.jsx
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ErrorMessage from "../../components/common/ErrorMessage";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    // Validaciones básicas
    const newErrors = {};
    if (!credentials.email.trim()) {
      newErrors.email = "Email es requerido";
    }
    if (!credentials.password) {
      newErrors.password = "Contraseña es requerida";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    const result = await login(credentials);
    setLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      if (result.validationErrors) {
        setErrors(result.validationErrors);
      } else {
        setGeneralError(result.error);
      }
    }
  };

  const handleChange = (field) => (e) => {
    setCredentials((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900">
            Sistema Biblioteca
          </h2>
          <p className="mt-2 text-sm text-center text-gray-600">
            Ingresa a tu cuenta
          </p>
        </div>

        <div className="p-8 bg-white border rounded-lg">
          {generalError && (
            <div className="mb-4">
              <ErrorMessage message={generalError} />
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              value={credentials.email}
              onChange={handleChange("email")}
              error={errors.email}
              required
            />

            <Input
              label="Contraseña"
              type="password"
              value={credentials.password}
              onChange={handleChange("password")}
              error={errors.password}
              required
            />

            <Button type="submit" loading={loading} className="w-full">
              Iniciar Sesión
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/register"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ¿No tienes cuenta? Regístrate aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
