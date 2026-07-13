// app/router/index.tsx

import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '../providers/AppLayout';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { setApiErrorHandler } from '@/shared/api/client';
import { isPublicAppRoute } from '@/shared/auth/unauthorized';
import { registerSessionUnauthorizedHandler } from '@/shared/auth/sessionUnauthorized';
import { useAuthStore, useToastStore } from '@/app/store';
import { ToastContainer } from '@/shared/ui/Toast/Toast';
import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';
import { lazyWithRetry } from '@/shared/lib/lazyWithRetry';

const HomePage        = lazyWithRetry(() => import('@/pages/home/HomePage'));
const EventPage       = lazyWithRetry(() => import('@/pages/event/EventPage'));
const UserPage        = lazyWithRetry(() => import('@/pages/user/UserPage'));
const MyEventsPage    = lazyWithRetry(() => import('@/pages/my-events/MyEventsPage'));
const CreateEventPage = lazyWithRetry(() => import('@/pages/create-event/CreateEventPage'));
const AdminPage       = lazyWithRetry(() => import('@/pages/admin/AdminPage'));
const SettingsPage    = lazyWithRetry(() => import('@/pages/settings/SettingsPage'));
const WalletPage      = lazyWithRetry(() => import('@/pages/wallet/WalletPage'));
const LoginPage       = lazyWithRetry(() => import('@/pages/auth/LoginPage'));
const ActivationPage  = lazyWithRetry(() => import('@/pages/auth/ActivationPage'));
const RegisterPage    = lazyWithRetry(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/auth/ForgotPasswordPage'));
const InvitationsPage = lazyWithRetry(() => import('@/pages/invitations/InvitationsPage'));
const EventAlbumsPage = lazyWithRetry(() => import('@/pages/event-albums/EventAlbumsPage'));
const NotFoundPage    = lazyWithRetry(() => import('@/pages/not-found/NotFoundPage'));

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
  { path: '/forgot-password', element: <AuthGuard>{S(ForgotPasswordPage)}</AuthGuard> },

  // ---- Основное приложение (гостевой доступ к поиску, событию, профилю) ----
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,              element: S(HomePage) },
      { path: 'event/:id',        element: S(EventPage) },
      { path: 'user/:id',         element: S(UserPage) },
      { path: 'invitations',      element: <RequireAuth>{S(InvitationsPage)}</RequireAuth> },
      { path: 'event-albums',     element: <RequireAuth>{S(EventAlbumsPage)}</RequireAuth> },
      { path: 'my-events',        element: <RequireAuth>{S(MyEventsPage)}</RequireAuth> },
      { path: 'create-event',     element: <RequireAuth>{S(CreateEventPage)}</RequireAuth> },
      { path: 'edit-event/:id',   element: <RequireAuth>{S(CreateEventPage)}</RequireAuth> },
      { path: 'admin',            element: <RequireAuth>{S(AdminPage)}</RequireAuth> },
      { path: 'settings',         element: <RequireAuth>{S(SettingsPage)}</RequireAuth> },
      { path: 'wallet',           element: <RequireAuth>{S(WalletPage)}</RequireAuth> },
      { path: '*',                element: S(NotFoundPage) },
    ],
  },
]);

// 401 от API / WebSocket — сброс токена и редирект (кроме публичных auth-страниц)
registerSessionUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
  if (!isPublicAppRoute()) {
    const loginPath = '/login';
    router.navigate(loginPath, { replace: true });
    // Если SPA-навигация не сработала (вызов из fetch/WS вне React) — жёсткий переход
    window.setTimeout(() => {
      if (!isPublicAppRoute()) {
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
