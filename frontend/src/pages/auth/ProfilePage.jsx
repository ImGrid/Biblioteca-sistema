// src/pages/auth/ProfilePage.jsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useApi } from "../../hooks/useApi";
import { authService } from "../../services/auth";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import { formatDate } from "../../utils/formatters";

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    address: user?.address || "",
  });
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  const { loading: profileLoading, execute: executeUpdateProfile } = useApi(
    authService.updateProfile
  );
  const { loading: passwordLoading, execute: executeChangePassword } = useApi(
    authService.changePassword
  );

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileErrors({});
    setProfileSuccess("");

    const result = await executeUpdateProfile(profileData);

    if (result.success) {
      updateProfile(result.data);
      setProfileSuccess("Perfil actualizado exitosamente");
    } else {
      if (result.error.details) {
        setProfileErrors(result.error.details);
      }
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrors({});
    setPasswordSuccess("");

    // Validar confirmación de contraseña
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordErrors({ confirm_password: "Las contraseñas no coinciden" });
      return;
    }

    const result = await executeChangePassword({
      current_password: passwordData.current_password,
      new_password: passwordData.new_password,
    });

    if (result.success) {
      setPasswordSuccess("Contraseña cambiada exitosamente");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } else {
      if (result.error.details) {
        setPasswordErrors(result.error.details);
      }
    }
  };

  const handleProfileChange = (field) => (e) => {
    setProfileData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handlePasswordChange = (field) => (e) => {
    setPasswordData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>

      {/* Información de la cuenta */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Información de la cuenta
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Email:</span>
            <p className="text-gray-900">{user?.email}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Rol:</span>
            <p className="text-gray-900 capitalize">{user?.role}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Miembro desde:</span>
            <p className="text-gray-900">{formatDate(user?.created_at)}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Último acceso:</span>
            <p className="text-gray-900">
              {formatDate(user?.last_login) || "Primera vez"}
            </p>
          </div>
        </div>
      </div>

      {/* Actualizar información personal */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Información Personal
        </h2>

        {profileSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800">
            {profileSuccess}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={profileData.first_name}
              onChange={handleProfileChange("first_name")}
              error={profileErrors.first_name}
              required
            />
            <Input
              label="Apellido"
              value={profileData.last_name}
              onChange={handleProfileChange("last_name")}
              error={profileErrors.last_name}
              required
            />
          </div>

          <Input
            label="Teléfono"
            value={profileData.phone}
            onChange={handleProfileChange("phone")}
            error={profileErrors.phone}
          />

          <Input
            label="Dirección"
            value={profileData.address}
            onChange={handleProfileChange("address")}
            error={profileErrors.address}
          />

          <Button type="submit" loading={profileLoading}>
            Actualizar Información
          </Button>
        </form>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Cambiar Contraseña
        </h2>

        {passwordSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800">
            {passwordSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            label="Contraseña Actual"
            type="password"
            value={passwordData.current_password}
            onChange={handlePasswordChange("current_password")}
            error={passwordErrors.current_password}
            required
          />

          <Input
            label="Nueva Contraseña"
            type="password"
            value={passwordData.new_password}
            onChange={handlePasswordChange("new_password")}
            error={passwordErrors.new_password}
            required
          />

          <Input
            label="Confirmar Nueva Contraseña"
            type="password"
            value={passwordData.confirm_password}
            onChange={handlePasswordChange("confirm_password")}
            error={passwordErrors.confirm_password}
            required
          />

          <Button type="submit" loading={passwordLoading}>
            Cambiar Contraseña
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
