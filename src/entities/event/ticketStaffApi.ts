// entities/event/ticketStaffApi.ts — билетёры на событии (W6a)

import { apiClient } from '@/shared/api/client';

export interface EventTicketStaffResponse {
  id: string;
  eventId: string;
  accountId: string;
  canCheckIn: boolean;
  canViewStats: boolean;
  createDate?: string | null;
  updateDate?: string | null;
}

export interface EventTicketStaffItemRequest {
  accountId: string;
  canCheckIn?: boolean;
  canViewStats?: boolean;
}

/** GET /api/events/{eventId}/ticket-staff */
export async function fetchEventTicketStaff(
  eventId: string,
): Promise<EventTicketStaffResponse[]> {
  const r = await apiClient.get<EventTicketStaffResponse[]>(
    `/api/events/${eventId}/ticket-staff`,
  );
  return r.result ?? [];
}

/** PUT /api/events/{eventId}/ticket-staff — полная замена списка */
export async function setEventTicketStaff(
  eventId: string,
  staff: EventTicketStaffItemRequest[],
): Promise<void> {
  await apiClient.put(`/api/events/${eventId}/ticket-staff`, {
    staff: staff.map(s => ({
      accountId: s.accountId,
      canCheckIn: s.canCheckIn ?? true,
      canViewStats: s.canViewStats ?? true,
    })),
  });
}
