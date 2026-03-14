import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for API calls with loading, data, and error states.
 * @param {Function} apiFn - Async function to call
 * @param {Object} options - { immediate: boolean, onSuccess, onError }
 */
export default function useApi(apiFn, options = {}) {
  const { immediate = false, onSuccess, onError } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(...args);
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
          onSuccess?.(result);
        }
        return result;
      } catch (err) {
        if (mountedRef.current) {
          setError(err);
          setLoading(false);
          onError?.(err);
        }
        throw err;
      }
    },
    [apiFn, onSuccess, onError]
  );

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
