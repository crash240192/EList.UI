// features/auth/AuthGuard.tsx

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import { getOrCreateClientHash, isAuthenticated as hasAuthToken } from '@/shared/api/client';
import { isPublicAuthRoute, requiresAuthRoute } from '@/shared/auth/routes';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const token = useAuthStore(s => s.token);
  const needsActivation = useAuthStore(s => s.activationRequired);
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { getOrCreateClientHash(); }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const pathname = location.pathname;
      const isPublic = isPublicAuthRoute(pathname);

      if (!hasAuthToken()) {
        if (requiresAuthRoute(pathname)) {
          navigate('/login', { replace: true, state: { from: pathname } });
        }
        return;
      }

      if (needsActivation) {
        if (pathname !== '/activate' && pathname !== '/login') {
          navigate('/activate', { replace: true });
        }
        return;
      }

      if (isPublic && (pathname === '/login' || pathname === '/register')) {
        navigate('/', { replace: true });
      }
    }, 50);

    return () => clearTimeout(timerRef.current);
  }, [token, needsActivation, location.pathname, navigate]);

  return <>{children}</>;
}
