// entities/event/ticketDeskHubApi.ts — hub «Билеты» (W6c)

import { apiClient } from '@/shared/api/client';

export interface TicketDeskHubItem {
  eventId: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
  ticketsEnabled: boolean;
  organizationId?: string | null;
  organizationName?: string | null;
  /** organizer | staff */
  access: 'organizer' | 'staff' | string;
  canCheckIn: boolean;
  canViewStats: boolean;
  sold?: number | null;
  issuedOpen?: number | null;
  used?: number | null;
  ordersPending?: number | null;
  remaining?: number | null;
}

/** GET /api/events/ticket-desk/hub */
export async function fetchTicketDeskHub(
  limit = 100,
): Promise<TicketDeskHubItem[]> {
  const q = limit !== 100 ? `?limit=${limit}` : '';
  const r = await apiClient.get<TicketDeskHubItem[]>(
    `/api/events/ticket-desk/hub${q}`,
  );
  return r.result ?? [];
}
