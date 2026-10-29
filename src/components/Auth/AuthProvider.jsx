import { useEffect, useState } from 'react';
import { AuthContext } from '../../services/authContext';
import { apiRequest } from '../../services/apiClient';
import { getSession, portalRoleForUser } from '../../services/auth';

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const changed = () => {
      const nextSession = getSession();
      setSession(nextSession);
      setLoading(Boolean(nextSession));
      setError('');
      setVersion((value) => value + 1);
    };
    window.addEventListener('venueflow_auth_changed', changed);
    return () => window.removeEventListener('venueflow_auth_changed', changed);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const stored = getSession();
    if (!stored) return;
    apiRequest('api/v1/auth/me', { signal: controller.signal })
      .then((user) => {
        if (controller.signal.aborted) return;
        const role = portalRoleForUser(user, stored.role);
        const verified = { ...stored, user, role };
        sessionStorage.setItem(
          'venueflow_session_v1',
          JSON.stringify(verified),
        );
        setSession(verified);
        setError('');
        setLoading(false);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [version]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user,
        loading: session ? loading : false,
        error: session ? error : '',
        retry: () => setVersion((value) => value + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
