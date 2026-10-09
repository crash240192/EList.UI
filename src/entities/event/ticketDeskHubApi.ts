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
  /** Owner/Manager — undo Used→Issued (не TicketTaker) */
  canUndoCheckIn?: boolean;
  sold?: number | null;
  issuedOpen?: number | null;
  used?: number | null;
  ordersPending?: number | null;
  remaining?: number | null;
}

function normalizeHubItem(raw: Record<string, unknown>): TicketDeskHubItem {
  const access = String(raw.access ?? raw.Access ?? 'organizer');
  const canUndo = raw.canUndoCheckIn ?? raw.CanUndoCheckIn;
  return {
    eventId: String(raw.eventId ?? raw.EventId ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    startTime: String(raw.startTime ?? raw.StartTime ?? ''),
    endTime: String(raw.endTime ?? raw.EndTime ?? ''),
    active: Boolean(raw.active ?? raw.Active),
    ticketsEnabled: Boolean(raw.ticketsEnabled ?? raw.TicketsEnabled),
    organizationId: (raw.organizationId ?? raw.OrganizationId ?? null) as string | null,
    organizationName: (raw.organizationName ?? raw.OrganizationName ?? null) as string | null,
    access,
    canCheckIn: Boolean(raw.canCheckIn ?? raw.CanCheckIn),
    canViewStats: Boolean(raw.canViewStats ?? raw.CanViewStats),
    canUndoCheckIn: canUndo != null
      ? Boolean(canUndo)
      : access === 'organizer',
    sold: (raw.sold ?? raw.Sold ?? null) as number | null,
    issuedOpen: (raw.issuedOpen ?? raw.IssuedOpen ?? null) as number | null,
    used: (raw.used ?? raw.Used ?? null) as number | null,
    ordersPending: (raw.ordersPending ?? raw.OrdersPending ?? null) as number | null,
    remaining: (raw.remaining ?? raw.Remaining ?? null) as number | null,
  };
}

/** GET /api/events/ticket-desk/hub */
export async function fetchTicketDeskHub(
  limit = 100,
): Promise<TicketDeskHubItem[]> {
  const q = limit !== 100 ? `?limit=${limit}` : '';
  const r = await apiClient.get<Record<string, unknown>[]>(
    `/api/events/ticket-desk/hub${q}`,
  );
  return (r.result ?? []).map(row => normalizeHubItem(row as Record<string, unknown>));
}
