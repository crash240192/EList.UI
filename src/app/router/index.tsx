// app/router/index.tsx

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppLayout } from '../providers/AppLayout';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { setApiErrorHandler } from '@/shared/api/client';
import { isPublicAuthRoute } from '@/shared/auth/unauthorized';
import { registerSessionUnauthorizedHandler } from '@/shared/auth/sessionUnauthorized';
import { useAuthStore, useToastStore } from '@/app/store';
import { ToastContainer } from '@/shared/ui/Toast/Toast';
import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';

const HomePage        = lazy(() => import('@/pages/home/HomePage'));
const EventPage       = lazy(() => import('@/pages/event/EventPage'));
const UserPage        = lazy(() => import('@/pages/user/UserPage'));
const MyEventsPage    = lazy(() => import('@/pages/my-events/MyEventsPage'));
const CreateEventPage = lazy(() => import('@/pages/create-event/CreateEventPage'));
const AdminPage       = lazy(() => import('@/pages/admin/AdminPage'));
const SettingsPage    = lazy(() => import('@/pages/settings/SettingsPage'));
const WalletPage      = lazy(() => import('@/pages/wallet/WalletPage'));
const LoginPage       = lazy(() => import('@/pages/auth/LoginPage'));
const ActivationPage  = lazy(() => import('@/pages/auth/ActivationPage'));
const RegisterPage    = lazy(() => import('@/pages/auth/RegisterPage'));

const Loader = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      width: '100%',
    }}
  >
    <AppPreloader layout="block" size="md" aria-label="Загрузка страницы" />
  </div>
);

const S = (Component: React.ComponentType) => (
  <Suspense fallback={<Loader />}><Component /></Suspense>
);

const router = createBrowserRouter([
  // ---- Публичные маршруты (без AppLayout) ----
  { path: '/login',    element: <AuthGuard>{S(LoginPage)}</AuthGuard> },
  { path: '/activate', element: <AuthGuard>{S(ActivationPage)}</AuthGuard> },
  { path: '/register', element: <AuthGuard>{S(RegisterPage)}</AuthGuard> },

  // ---- Защищённые маршруты (с AppLayout) ----
  {
    path: '/',
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      { index: true,              element: S(HomePage) },
      { path: 'event/:id',        element: S(EventPage) },
      { path: 'user/:id',         element: S(UserPage) },
      { path: 'invitations',       element: S(lazy(() => import('@/pages/invitations/InvitationsPage'))) },
      { path: 'my-events',        element: S(MyEventsPage) },
      { path: 'create-event',     element: S(CreateEventPage) },
      { path: 'edit-event/:id',   element: S(CreateEventPage) },
      { path: 'admin',            element: S(AdminPage) },
      { path: 'settings',         element: S(SettingsPage) },
      { path: 'wallet',           element: S(WalletPage) },
      { path: '*',                element: <Navigate to="/" replace /> },
    ],
  },
]);

// 401 от API / WebSocket — сброс токена и редирект (кроме /login, /activate, /register)
registerSessionUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
  if (!isPublicAuthRoute()) {
    const loginPath = '/login';
    router.navigate(loginPath, { replace: true });
    // Если SPA-навигация не сработала (вызов из fetch/WS вне React) — жёсткий переход
    window.setTimeout(() => {
      if (!isPublicAuthRoute()) {
        window.location.replace(loginPath);
      }
    }, 150);
  }
});

// Регистрируем обработчик API-ошибок (success === false с непустым message)
setApiErrorHandler((message) => {
  useToastStore.getState().add(message);
});

export function AppRouter() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />
    </>
  );
}
