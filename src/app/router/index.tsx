// app/router/index.tsx

import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppLayout } from '../providers/AppLayout';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { setApiErrorHandler } from '@/shared/api/client';
import { isPublicAuthRoute } from '@/shared/auth/unauthorized';
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
const InvitationsPage = lazyWithRetry(() => import('@/pages/invitations/InvitationsPage'));
const EventAlbumsPage = lazyWithRetry(() => import('@/pages/event-albums/EventAlbumsPage'));

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
      { path: 'invitations',       element: S(InvitationsPage) },
      { path: 'event-albums',      element: S(EventAlbumsPage) },
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
