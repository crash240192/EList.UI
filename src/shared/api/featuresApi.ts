// Публичные feature-flags API (без auth). Endpoint возвращает plain JSON, не CommandResult.

import { getAppVersion, getClientPlatform, getOrCreateClientHash } from '@/shared/api/client';

export interface IAppFeatures {
  /** Создание организаций и сбор legal/payout/verification. */
  organizationsEnabled: boolean;
  /** Показ рекламных блоков (РСЯ / плейсхолдеры). */
  adsEnabled: boolean;
  /** Весь билетный модуль (заказы, desk, check-in, my-tickets). */
  ticketsEnabled: boolean;
  /** Платные продажи (имеет смысл только при ticketsEnabled). */
  ticketSalesEnabled: boolean;
  /** Desk: показывать login/ФИО holder (server flag) */
  ticketDeskRevealHolder: boolean;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/eList';

let cached: IAppFeatures | null = null;
let inflight: Promise<IAppFeatures> | null = null;

const DISABLED: IAppFeatures = {
  organizationsEnabled: false,
  adsEnabled: false,
  ticketsEnabled: false,
  ticketSalesEnabled: false,
  ticketDeskRevealHolder: false,
};

/** GET /api/features — кэш на сессию вкладки. */
export async function fetchAppFeatures(force = false): Promise<IAppFeatures> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/features`, {
        headers: {
          'authorization-jwt': getOrCreateClientHash(),
          'X-Client-Platform': getClientPlatform(),
          'X-App-Version': getAppVersion(),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json() as Record<string, unknown>;
      const ticketsEnabled = Boolean(
        raw.ticketsEnabled ?? raw.TicketsEnabled ?? false,
      );
      cached = {
        organizationsEnabled: Boolean(
          raw.organizationsEnabled ?? raw.OrganizationsEnabled ?? false,
        ),
        adsEnabled: Boolean(
          raw.adsEnabled ?? raw.AdsEnabled ?? false,
        ),
        ticketsEnabled,
        // На всякий случай: продажи не могут быть шире модуля билетов.
        ticketSalesEnabled: ticketsEnabled && Boolean(
          raw.ticketSalesEnabled ?? raw.TicketSalesEnabled ?? false,
        ),
        ticketDeskRevealHolder: Boolean(
          raw.ticketDeskRevealHolder ?? raw.TicketDeskRevealHolder ?? false,
        ),
      };
      return cached;
    } catch {
      cached = { ...DISABLED };
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
