// features/notifications/useNotificationsWebSocket.ts

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/app/store';
import { parseWsNotificationMessage } from '@/entities/notification/parseNotification';
import { isNewInvitationNotification } from '@/entities/notification/eventData';
import { buildNotificationsWebSocketUrl } from '@/shared/lib/notificationsWsUrl';
import { useInvitationsStore } from '@/features/invitations/invitationsStore';
import { useNotificationsStore } from './notificationsStore';

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Держит WebSocket к /eList/ws/notifications пока пользователь авторизован.
 */
export function useNotificationsWebSocket(enabled: boolean): void {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated());
  const token = useAuthStore(s => s.token);
  const setWsStatus = useNotificationsStore(s => s.setWsStatus);
  const pushNotification = useNotificationsStore(s => s.pushNotification);
  const reset = useNotificationsStore(s => s.reset);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    };

    if (!enabled || !isAuthenticated || !token) {
      clearReconnect();
      closeSocket();
      reset();
      useInvitationsStore.getState().reset();
      return () => {
        unmountedRef.current = true;
        clearReconnect();
        closeSocket();
      };
    }

    const scheduleReconnect = () => {
      if (unmountedRef.current) return;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** attemptRef.current,
        RECONNECT_MAX_MS,
      );
      attemptRef.current += 1;
      clearReconnect();
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (unmountedRef.current) return;

      const url = buildNotificationsWebSocketUrl();
      if (!url) {
        setWsStatus('error', 'Нет токена авторизации');
        return;
      }

      clearReconnect();
      closeSocket();
      setWsStatus('connecting', null);

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        setWsStatus('error', 'Не удалось открыть WebSocket');
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        attemptRef.current = 0;
        setWsStatus('open', null);
      };

      ws.onmessage = ev => {
        if (typeof ev.data !== 'string') return;
        const n = parseWsNotificationMessage(ev.data);
        if (!n) return;
        pushNotification(n);
        if (isNewInvitationNotification(n.type)) {
          useInvitationsStore.getState().incrementNotViewedCount();
        }
      };

      ws.onerror = () => {
        if (unmountedRef.current) return;
        setWsStatus('error', 'Ошибка соединения');
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        wsRef.current = null;
        setWsStatus('closed', null);
        scheduleReconnect();
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState !== WebSocket.OPEN) {
        attemptRef.current = 0;
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unmountedRef.current = true;
      document.removeEventListener('visibilitychange', onVisibility);
      clearReconnect();
      closeSocket();
      reset();
    };
  }, [enabled, isAuthenticated, token, setWsStatus, pushNotification, reset]);
}
