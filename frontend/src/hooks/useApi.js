// src/hooks/useApi.js
import { useState, useCallback, useEffect } from "react";

// Hook básico para llamadas API
export const useApi = (apiFunction, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const execute = useCallback(
    async (...args) => {
      try {
        setLoading(true);
        setError("");
        const response = await apiFunction(...args);

        if (response.success) {
          setData(response.data);
          return { success: true, data: response.data };
        } else {
          setError(response.message || "Error en la solicitud");
          return { success: false, error: response.message };
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.error?.message || "Error de conexión";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [apiFunction]
  );

  return { data, loading, error, execute };
};

// Hook para APIs paginadas
export const usePaginatedApi = (
  apiFunction,
  initialParams = {},
  options = {}
) => {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [params, setParams] = useState(initialParams);

  const fetchData = useCallback(
    async (newParams = {}) => {
      try {
        setLoading(true);
        setError("");

        const queryParams = { ...params, ...newParams };
        const response = await apiFunction(queryParams);

        if (response.success) {
          setItems(response.data || []);
          if (response.pagination) {
            setPagination(response.pagination);
          }
        } else {
          setError(response.message || "Error al cargar datos");
          setItems([]);
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.error?.message || "Error de conexión";
        setError(errorMessage);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, params]
  );

  const changePage = useCallback(
    (newPage) => {
      const updatedParams = { ...params, page: newPage };
      setParams(updatedParams);
      fetchData(updatedParams);
    },
    [params, fetchData]
  );

  const updateParams = useCallback(
    (newParams) => {
      const updatedParams = { ...params, ...newParams };
      setParams(updatedParams);
      fetchData(updatedParams);
    },
    [params, fetchData]
  );

  const refresh = useCallback(() => {
    fetchData(params);
  }, [fetchData, params]);

  // Auto-fetch si immediate: true
  useEffect(() => {
    if (options.immediate) {
      fetchData();
    }
  }, [fetchData]); // Re-fetch when fetchData changes (e.g., when apiFunction changes)

  return {
    items,
    pagination,
    loading,
    error,
    fetchData,
    changePage,
    updateParams,
    refresh,
  };
};
