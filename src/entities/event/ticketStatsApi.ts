// entities/event/ticketStatsApi.ts — сводки билетов (W6b)

import { apiClient } from '@/shared/api/client';

export interface EventTicketTypeStatsItem {
  ticketTypeId?: string | null;
  ticketTypeName: string;
  sold: number;
  issuedOpen: number;
  used: number;
  refundPending: number;
  refunded: number;
  void: number;
  ordersPending: number;
  reserved: number;
  capacity?: number | null;
  remaining?: number | null;
}

export interface EventTicketStatsResponse {
  eventId: string;
  sold: number;
  issuedOpen: number;
  used: number;
  refundPending: number;
  refunded: number;
  void: number;
  ordersPending: number;
  reserved: number;
  remaining?: number | null;
  byStatus: Record<string, number>;
  byType: EventTicketTypeStatsItem[];
}

export interface OrganizationEventTicketSummaryItem {
  eventId: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
  ticketsEnabled: boolean;
  sold: number;
  issuedOpen: number;
  used: number;
  ordersPending: number;
  remaining?: number | null;
}

/** GET /api/events/{eventId}/tickets/stats */
export async function fetchEventTicketStats(
  eventId: string,
): Promise<EventTicketStatsResponse> {
  const r = await apiClient.get<EventTicketStatsResponse>(
    `/api/events/${eventId}/tickets/stats`,
  );
  if (!r.result) throw new Error(r.message || 'Не удалось загрузить статистику билетов');
  return r.result;
}

/** GET /api/organizations/{organizationId}/events/ticket-summary */
export async function fetchOrganizationEventsTicketSummary(
  organizationId: string,
  limit = 100,
): Promise<OrganizationEventTicketSummaryItem[]> {
  const q = limit !== 100 ? `?limit=${limit}` : '';
  const r = await apiClient.get<OrganizationEventTicketSummaryItem[]>(
    `/api/organizations/${organizationId}/events/ticket-summary${q}`,
  );
  return r.result ?? [];
}
