// features/tickets/ticketDeskAccess.ts — видимость пункта «Билеты»

import {
  OrganizationRole,
  fetchMyOrganizations,
  type OrganizationResponse,
} from '@/entities/organization';
import { fetchTicketDeskHub } from '@/entities/event';
import { fetchAppFeatures } from '@/shared/api/featuresApi';

/** Org даёт доступ к билетному hub (продажи или роль в команде). */
export function organizationGrantsTicketDesk(org: OrganizationResponse): boolean {
  if (org.canSellTickets) return true;
  const members = org.members ?? [];
  return members.some(m =>
    m.active !== false
    && (m.role === OrganizationRole.Owner
      || m.role === OrganizationRole.Manager
      || m.role === OrganizationRole.TicketTaker),
  );
}

/**
 * Показать сайдбар «Билеты», если модуль включён и есть org с билетами/ролью
 * или уже есть назначения на desk (staff).
 */
export async function canShowTicketDeskNav(): Promise<boolean> {
  try {
    const features = await fetchAppFeatures();
    if (!features.ticketsEnabled) return false;

    const [orgs, hub] = await Promise.all([
      fetchMyOrganizations(),
      fetchTicketDeskHub(1),
    ]);
    if (hub.length > 0) return true;
    return orgs.some(organizationGrantsTicketDesk);
  } catch {
    return false;
  }
}
