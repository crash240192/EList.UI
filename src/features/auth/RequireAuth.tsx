// features/auth/RequireAuth.tsx — доступ только авторизованным
// Гостя с защищённого URL уводим на главную (анонимный просмотр), а не на /login.
// Диалог входа показывает AppLayout по state.authRequiredFrom.

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import { isAuthenticated as hasAuthToken } from '@/shared/api/client';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const token = useAuthStore(s => s.token);
  const needsActivation = useAuthStore(s => s.activationRequired);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!hasAuthToken()) {
      const from = `${location.pathname}${location.search}`;
      navigate('/', { replace: true, state: { authRequiredFrom: from } });
      return;
    }
    if (needsActivation && location.pathname !== '/activate') {
      navigate('/activate', { replace: true });
    }
  }, [token, needsActivation, location.pathname, location.search, navigate]);

  if (!hasAuthToken() || needsActivation) return null;

  return <>{children}</>;
}
