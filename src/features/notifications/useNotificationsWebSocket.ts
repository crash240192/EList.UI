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
/** Быстрый обрыв после open — увеличиваем паузу (часто гонка двух сокетов / Edge) */
const RAPID_CLOSE_MS = 2_500;

/**
 * Держит WebSocket к /eList/ws/notifications пока пользователь авторизован.
 */
export function useNotificationsWebSocket(enabled: boolean): void {
  const token = useAuthStore(s => s.token);
  const setWsStatus = useNotificationsStore(s => s.setWsStatus);
  const pushNotification = useNotificationsStore(s => s.pushNotification);
  const reset = useNotificationsStore(s => s.reset);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const connectionGenRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const connectInFlightRef = useRef(false);
  const openedAtRef = useRef(0);

  useEffect(() => {
    unmountedRef.current = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    /** Закрыть сокет без переподключения (смена gen отменяет onclose) */
    const closeSocketSilently = () => {
      connectionGenRef.current += 1;
      connectInFlightRef.current = false;
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

    if (!enabled || !token) {
      clearReconnect();
      closeSocketSilently();
      reset();
      useInvitationsStore.getState().reset();
      return () => {
        unmountedRef.current = true;
        clearReconnect();
        closeSocketSilently();
      };
    }

    const scheduleReconnect = () => {
      if (unmountedRef.current) return;
      const lived = Date.now() - openedAtRef.current;
      const rapidClose = openedAtRef.current > 0 && lived < RAPID_CLOSE_MS;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** attemptRef.current * (rapidClose ? 2 : 1),
        RECONNECT_MAX_MS,
      );
      attemptRef.current += 1;
      clearReconnect();
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (unmountedRef.current || connectInFlightRef.current) return;

      const url = buildNotificationsWebSocketUrl();
      if (!url) {
        setWsStatus('error', 'Нет токена авторизации');
        return;
      }

      clearReconnect();
      closeSocketSilently();
      const myGen = connectionGenRef.current;
      connectInFlightRef.current = true;
      setWsStatus('connecting', null);

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        connectInFlightRef.current = false;
        setWsStatus('error', 'Не удалось открыть WebSocket');
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current || myGen !== connectionGenRef.current) return;
        connectInFlightRef.current = false;
        attemptRef.current = 0;
        openedAtRef.current = Date.now();
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
        if (unmountedRef.current || myGen !== connectionGenRef.current) return;
        setWsStatus('error', 'Ошибка соединения');
      };

      ws.onclose = () => {
        if (unmountedRef.current || myGen !== connectionGenRef.current) return;
        connectInFlightRef.current = false;
        wsRef.current = null;
        setWsStatus('closed', null);
        scheduleReconnect();
      };
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (connectInFlightRef.current) return;
      const state = wsRef.current?.readyState;
      if (state === WebSocket.OPEN) return;
      if (state === WebSocket.CONNECTING) return;
      attemptRef.current = 0;
      connect();
    };

    connect();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unmountedRef.current = true;
      document.removeEventListener('visibilitychange', onVisibility);
      clearReconnect();
      closeSocketSilently();
      // Не вызываем reset() — иначе при ремонте effect (Strict Mode / Edge) мигает «онлайн» ↔ «переподключение»
    };
  }, [enabled, token, setWsStatus, pushNotification, reset]);
}
