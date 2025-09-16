import { useAuth } from "../context/AuthContext";

// Re-export del hook para conveniencia
export { useAuth };

// Hook adicional para verificar loading de auth
export const useAuthLoading = () => {
  const { loading } = useAuth();
  return loading;
};
