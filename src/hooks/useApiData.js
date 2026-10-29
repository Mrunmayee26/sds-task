import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient';

export function useApiData(path) {
  const [result, setResult] = useState({ data: [], loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`api/v1/${path}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ data: [], loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [path, version]);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 30000);
    return () => {
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
    };
  }, [refresh]);
  return { ...result, refresh };
}
