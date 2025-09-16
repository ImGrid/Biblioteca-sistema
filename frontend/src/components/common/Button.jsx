// src/components/common/Button.jsx
import React from "react";

const Button = ({
  children,
  onClick,
  type = "button",
  loading = false,
  disabled = false,
  size = "md",
  variant = "primary",
  className = "",
}) => {
  const baseClasses =
    "font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    outline:
      "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500",
    danger_outline:
      "border border-red-300 text-red-700 bg-white hover:bg-red-50 focus:ring-red-500",
  };

  const combinedClassName = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={combinedClassName}
    >
      {loading ? "Cargando..." : children}
    </button>
  );
};

export default Button;
