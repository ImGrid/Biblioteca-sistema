// src/pages/auth/RegisterPage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ErrorMessage from "../../components/common/ErrorMessage";

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState({
    email: "",
    password: "",
    confirm_password: "",
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
  });
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    // Validaciones básicas
    const newErrors = {};
    if (!userData.email.trim()) newErrors.email = "Email es requerido";
    if (!userData.password) newErrors.password = "Contraseña es requerida";
    if (!userData.first_name.trim())
      newErrors.first_name = "Nombre es requerido";
    if (!userData.last_name.trim())
      newErrors.last_name = "Apellido es requerido";

    if (userData.password !== userData.confirm_password) {
      newErrors.confirm_password = "Las contraseñas no coinciden";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    const { confirm_password, ...registerData } = userData;
    const result = await register(registerData);
    setLoading(false);

    if (result.success) {
      setSuccess("Cuenta creada exitosamente. Ya puedes iniciar sesión.");
      setTimeout(() => navigate("/login"), 2000);
    } else {
      if (result.validationErrors) {
        setErrors(result.validationErrors);
      } else {
        setGeneralError(result.error);
      }
    }
  };

  const handleChange = (field) => (e) => {
    setUserData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Crear Cuenta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Regístrate en el sistema biblioteca
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg border">
          {generalError && (
            <div className="mb-4">
              <ErrorMessage message={generalError} />
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800">
              {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                value={userData.first_name}
                onChange={handleChange("first_name")}
                error={errors.first_name}
                required
              />
              <Input
                label="Apellido"
                value={userData.last_name}
                onChange={handleChange("last_name")}
                error={errors.last_name}
                required
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={userData.email}
              onChange={handleChange("email")}
              error={errors.email}
              required
            />

            <Input
              label="Teléfono"
              value={userData.phone}
              onChange={handleChange("phone")}
              error={errors.phone}
            />

            <Input
              label="Dirección"
              value={userData.address}
              onChange={handleChange("address")}
              error={errors.address}
            />

            <Input
              label="Contraseña"
              type="password"
              value={userData.password}
              onChange={handleChange("password")}
              error={errors.password}
              required
            />

            <Input
              label="Confirmar Contraseña"
              type="password"
              value={userData.confirm_password}
              onChange={handleChange("confirm_password")}
              error={errors.confirm_password}
              required
            />

            <Button type="submit" loading={loading} className="w-full">
              Crear Cuenta
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ¿Ya tienes cuenta? Inicia sesión aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
