// features/auth/AuthGuard.tsx

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
    // Небольшая задержка чтобы navigate() из LoginPage/RegisterPage
    // успел выполниться раньше AuthGuard'а
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const publicPaths = ['/login', '/activate', '/register'];
      const isPublic    = publicPaths.some(p => location.pathname.startsWith(p));

      if (!hasAuthToken()) {
        if (!isPublic) navigate('/login', { replace: true, state: { from: location.pathname } });
        return;
      }

      if (needsActivation) {
        // На /login остаёмся — LoginPage покажет уведомление и сам перейдёт на /activate
        if (location.pathname !== '/activate' && location.pathname !== '/login') {
          navigate('/activate', { replace: true });
        }
        return;
      }

      // Авторизован и активирован — публичные страницы отдаём главной
      // но НЕ /activate (туда попасть без needsActivation нельзя в нормальном потоке)
      if (location.pathname === '/login' || location.pathname === '/register') {
        navigate('/', { replace: true });
      }
    }, 50);

    return () => clearTimeout(timerRef.current);
  }, [token, needsActivation, location.pathname, navigate]);

  return <>{children}</>;
}
