// Публичные feature-flags API (без auth). Endpoint возвращает plain JSON, не CommandResult.

import { getAppVersion, getClientPlatform, getOrCreateClientHash } from '@/shared/api/client';

export interface IAppFeatures {
  ticketSalesEnabled: boolean;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/eList';

let cached: IAppFeatures | null = null;
let inflight: Promise<IAppFeatures> | null = null;

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
      cached = {
        ticketSalesEnabled: Boolean(
          raw.ticketSalesEnabled ?? raw.TicketSalesEnabled ?? false,
        ),
      };
      return cached;
    } catch {
      cached = { ticketSalesEnabled: false };
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
