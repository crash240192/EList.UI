// features/auth/AuthGuard.tsx
// Обёртка для защищённых маршрутов.
// Проверяет токен и activationRequired при каждом рендере.

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import { getOrCreateClientHash } from '@/shared/api/client';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, needsActivation } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Убеждаемся, что clientHash создан при первом открытии
  useEffect(() => { getOrCreateClientHash(); }, []);

  useEffect(() => {
    const publicPaths = ['/login', '/activate', '/register'];
    const isPublic    = publicPaths.some(p => location.pathname.startsWith(p));

    if (!isAuthenticated()) {
      if (!isPublic) navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }

    if (needsActivation()) {
      if (location.pathname !== '/activate') navigate('/activate', { replace: true });
      return;
    }

    // Авторизован и активирован — если на /login или /activate, редиректим на главную
    if (isPublic) navigate('/', { replace: true });
  }, [isAuthenticated, needsActivation, location.pathname, navigate]);

  return <>{children}</>;
}
