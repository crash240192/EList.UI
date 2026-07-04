// features/auth/AuthGuard.tsx — только страницы login / register / activate

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import { getOrCreateClientHash, isAuthenticated as hasAuthToken } from '@/shared/api/client';

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
      if (!hasAuthToken()) return;

      if (needsActivation) {
        if (location.pathname !== '/activate' && location.pathname !== '/login') {
          navigate('/activate', { replace: true });
        }
        return;
      }

      if (location.pathname === '/login' || location.pathname === '/register') {
        navigate('/', { replace: true });
      }
    }, 50);

    return () => clearTimeout(timerRef.current);
  }, [token, needsActivation, location.pathname, navigate]);

  return <>{children}</>;
}
