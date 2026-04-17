// app/router/index.tsx

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppLayout } from '../providers/AppLayout';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { setUnauthorizedHandler } from '@/shared/api/client';

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
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: '#6366f1', fontSize: 14 }}>
    Загрузка...
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

// Регистрируем обработчик 401 — при истечении токена редиректим на /login
setUnauthorizedHandler(() => {
  router.navigate('/login', { replace: true });
});

export function AppRouter() {
  return <RouterProvider router={router} />;
}
