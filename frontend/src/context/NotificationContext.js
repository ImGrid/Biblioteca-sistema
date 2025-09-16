import React, { createContext, useContext, useState } from "react";

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (notification) => {
    const id = Date.now().toString();
    const newNotification = {
      id,
      type: "info",
      duration: 5000,
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove después del duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Helpers para diferentes tipos
  const success = (message, options = {}) => {
    return addNotification({ ...options, type: "success", message });
  };

  const error = (message, options = {}) => {
    return addNotification({
      ...options,
      type: "error",
      message,
      duration: 8000,
    });
  };

  const warning = (message, options = {}) => {
    return addNotification({ ...options, type: "warning", message });
  };

  const info = (message, options = {}) => {
    return addNotification({ ...options, type: "info", message });
  };

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
