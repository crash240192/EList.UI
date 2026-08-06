// entities/organization/hostEligibility.ts
// Кто может создавать мероприятия от имени организации:
// активная организация + актуальная оферта организатора.
// Верификация / юр. данные / canSellTickets — только для продажи билетов.

import {
  DocumentType,
  checkOrganizationAgreement,
} from '@/entities/agreement';
import type { OrganizationResponse } from './types';

export function isOrganizationActiveForEvents(org: OrganizationResponse): boolean {
  return org.active !== false;
}

/** Активна ли организация и принята ли актуальная оферта организатора */
export async function canOrganizationHostEvents(
  organizationId: string,
  org?: OrganizationResponse | null,
): Promise<boolean> {
  if (org && !isOrganizationActiveForEvents(org)) return false;
  try {
    return await checkOrganizationAgreement(
      organizationId,
      DocumentType.OrganizationAgreement,
    );
  } catch {
    return false;
  }
}

/** Организации, от имени которых можно создавать мероприятия (без требования верификации) */
export async function filterOrganizationsEligibleToHostEvents(
  orgs: OrganizationResponse[],
): Promise<OrganizationResponse[]> {
  const active = orgs.filter(isOrganizationActiveForEvents);
  if (active.length === 0) return [];

  const rows = await Promise.all(
    active.map(async org => ({
      org,
      ok: await canOrganizationHostEvents(org.id, org),
    })),
  );
  return rows.filter(r => r.ok).map(r => r.org);
}
