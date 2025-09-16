import React, { useState } from "react";
import { usersService } from "../../services/users";
import { usePaginatedApi } from "../../hooks/useApi";
import { useNotification } from "../../context/NotificationContext";
import { formatDate } from "../../utils/formatters";
import Table from "../../components/tables/Table";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";

// Formulario para crear usuario
const CreateUserForm = ({ onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    role: "user",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    // Validaciones básicas
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = "Email es requerido";
    if (!formData.password) newErrors.password = "Contraseña es requerida";
    if (!formData.first_name.trim())
      newErrors.first_name = "Nombre es requerido";
    if (!formData.last_name.trim())
      newErrors.last_name = "Apellido es requerido";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await usersService.createUser(formData);
      if (result.success) {
        success("Usuario creado exitosamente");
        onSuccess();
      } else {
        if (result.error?.details) {
          setErrors(result.error.details);
        } else {
          showError(result.message || "Error al crear usuario");
        }
      }
    } catch (err) {
      showError(err.response?.data?.error?.message || "Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Crear Nuevo Usuario</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Nombre"
          value={formData.first_name}
          onChange={handleChange("first_name")}
          error={errors.first_name}
          required
        />
        <Input
          label="Apellido"
          value={formData.last_name}
          onChange={handleChange("last_name")}
          error={errors.last_name}
          required
        />
      </div>

      <Input
        label="Email"
        type="email"
        value={formData.email}
        onChange={handleChange("email")}
        error={errors.email}
        required
      />

      <Input
        label="Contraseña"
        type="password"
        value={formData.password}
        onChange={handleChange("password")}
        error={errors.password}
        required
      />

      <Input
        label="Teléfono"
        value={formData.phone}
        onChange={handleChange("phone")}
        error={errors.phone}
      />

      <Input
        label="Dirección"
        value={formData.address}
        onChange={handleChange("address")}
        error={errors.address}
      />

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Rol
        </label>
        <select
          value={formData.role}
          onChange={handleChange("role")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="user">Usuario</option>
          <option value="librarian">Bibliotecario</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      <div className="flex justify-end pt-4 space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Crear Usuario
        </Button>
      </div>
    </form>
  );
};

// Formulario para editar usuario
const EditUserForm = ({ user, onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    address: user?.address || "",
    role: user?.role || "user",
    is_active: user?.is_active !== false,
    max_loans: user?.max_loans || 3,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await usersService.updateUser(user.id, formData);
      if (result.success) {
        success("Usuario actualizado exitosamente");
        onSuccess();
      } else {
        if (result.error?.details) {
          setErrors(result.error.details);
        } else {
          showError(result.message || "Error al actualizar usuario");
        }
      }
    } catch (err) {
      showError(err.response?.data?.error?.message || "Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          Editar Usuario: {user?.first_name} {user?.last_name}
        </h2>
        <p className="text-sm text-gray-600">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Nombre"
          value={formData.first_name}
          onChange={handleChange("first_name")}
          error={errors.first_name}
        />
        <Input
          label="Apellido"
          value={formData.last_name}
          onChange={handleChange("last_name")}
          error={errors.last_name}
        />
      </div>

      <Input
        label="Teléfono"
        value={formData.phone}
        onChange={handleChange("phone")}
        error={errors.phone}
      />

      <Input
        label="Dirección"
        value={formData.address}
        onChange={handleChange("address")}
        error={errors.address}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Rol
          </label>
          <select
            value={formData.role}
            onChange={handleChange("role")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">Usuario</option>
            <option value="librarian">Bibliotecario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <Input
          label="Máximo Préstamos"
          type="number"
          min="1"
          max="10"
          value={formData.max_loans}
          onChange={handleChange("max_loans")}
          error={errors.max_loans}
        />
      </div>

      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={handleChange("is_active")}
          className="text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label
          htmlFor="is_active"
          className="text-sm font-medium text-gray-700"
        >
          Usuario activo
        </label>
      </div>

      <div className="flex justify-end pt-4 space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Actualizar Usuario
        </Button>
      </div>
    </form>
  );
};

export const UsersManagementPage = () => {
  const [filters, setFilters] = useState({
    role: "",
    active_only: false,
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const { success, error: showError } = useNotification();

  // Hook para listar usuarios con los endpoints correctos
  const {
    items: users,
    pagination,
    loading,
    error,
    changePage,
    updateParams,
    refresh,
  } = usePaginatedApi(
    usersService.getAllUsers,
    { page: 1, limit: 10, ...filters },
    { immediate: true }
  );

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    updateParams({ ...newFilters, page: 1 });
  };

  const handleToggleStatus = async (user) => {
    const action = user.is_active ? "desactivar" : "activar";
    if (
      !window.confirm(
        `¿Estás seguro de ${action} a ${user.first_name} ${user.last_name}?`
      )
    ) {
      return;
    }

    try {
      const result = await usersService.toggleUserStatus(user.id);
      if (result.success) {
        success(`Usuario ${action}do exitosamente`);
        refresh();
      } else {
        showError(result.message || `Error al ${action} usuario`);
      }
    } catch (err) {
      showError(err.response?.data?.error?.message || "Error de conexión");
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    refresh();
  };

  const handleEditSuccess = () => {
    setUserToEdit(null);
    refresh();
  };

  const getRoleBadge = (role) => {
    const roleColors = {
      admin: "bg-red-100 text-red-800",
      librarian: "bg-blue-100 text-blue-800",
      user: "bg-green-100 text-green-800",
    };
    const roleLabels = {
      admin: "Admin",
      librarian: "Bibliotecario",
      user: "Usuario",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          roleColors[role] || roleColors.user
        }`}
      >
        {roleLabels[role] || role}
      </span>
    );
  };

  const columns = [
    {
      key: "user_info",
      title: "Usuario",
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">
            {record.first_name} {record.last_name}
          </div>
          <div className="text-sm text-gray-500">{record.email}</div>
          <div className="text-xs text-gray-400">
            ID: {record.id} • Miembro desde: {formatDate(record.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: "role",
      title: "Rol",
      render: (value) => getRoleBadge(value),
    },
    {
      key: "contact",
      title: "Contacto",
      render: (_, record) => (
        <div className="text-sm">
          {record.phone && <div>📞 {record.phone}</div>}
          {record.address && (
            <div className="mt-1 text-xs text-gray-500">
              📍 {record.address}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      title: "Estado",
      render: (_, record) => (
        <div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              record.is_active
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {record.is_active ? "Activo" : "Inactivo"}
          </span>
          <div className="mt-1 text-xs text-gray-500">
            Max préstamos: {record.max_loans || 3}
          </div>
        </div>
      ),
    },
    {
      key: "last_activity",
      title: "Último Acceso",
      render: (_, record) => (
        <div className="text-sm text-gray-600">
          {record.last_login ? formatDate(record.last_login) : "Nunca"}
        </div>
      ),
    },
    {
      key: "actions",
      title: "Acciones",
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUserToEdit(record)}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant={record.is_active ? "danger" : "primary"}
            onClick={() => handleToggleStatus(record)}
          >
            {record.is_active ? "Desactivar" : "Activar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Gestión de Usuarios
        </h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Crear Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      {pagination && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {pagination.total}
            </div>
            <div className="text-sm text-gray-600">Total Usuarios</div>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {users.filter((u) => u.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Usuarios Activos</div>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {users.filter((u) => u.role === "admin").length}
            </div>
            <div className="text-sm text-gray-600">Administradores</div>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {users.filter((u) => u.role === "librarian").length}
            </div>
            <div className="text-sm text-gray-600">Bibliotecarios</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="p-6 bg-white border rounded-lg">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Filtros</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Rol
            </label>
            <select
              value={filters.role}
              onChange={(e) =>
                handleFilterChange({ ...filters, role: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="librarian">Bibliotecario</option>
              <option value="user">Usuario</option>
            </select>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="active_only"
              checked={filters.active_only}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  active_only: e.target.checked,
                })
              }
              className="text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="active_only"
              className="text-sm font-medium text-gray-700"
            >
              Solo usuarios activos
            </label>
          </div>
        </div>

        <div className="flex mt-4 space-x-2">
          <Button
            variant="outline"
            onClick={() => handleFilterChange({ role: "", active_only: false })}
          >
            Limpiar Filtros
          </Button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando usuarios..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={users}
          pagination={pagination}
          onPageChange={changePage}
          emptyMessage="No se encontraron usuarios con los filtros seleccionados"
        />
      )}

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      >
        <CreateUserForm
          onSuccess={handleCreateSuccess}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Modal Editar Usuario */}
      {userToEdit && (
        <Modal isOpen={!!userToEdit} onClose={() => setUserToEdit(null)}>
          <EditUserForm
            user={userToEdit}
            onSuccess={handleEditSuccess}
            onClose={() => setUserToEdit(null)}
          />
        </Modal>
      )}
    </div>
  );
};

export default UsersManagementPage;
