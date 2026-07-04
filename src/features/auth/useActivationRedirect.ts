// features/auth/useActivationRedirect.ts

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import { isAuthenticated as hasAuthToken } from '@/shared/api/client';

/** Перенаправляет на /activate, если есть токен, но аккаунт не активирован */
export function useActivationRedirect(): void {
  const needsActivation = useAuthStore(s => s.activationRequired);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!hasAuthToken() || !needsActivation) return;
    if (location.pathname !== '/activate' && location.pathname !== '/login') {
      navigate('/activate', { replace: true });
    }
  }, [needsActivation, location.pathname, navigate]);
}
