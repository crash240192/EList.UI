// features/agreements/orgEventAgreements.ts
// Проверка актуальности оферты организации и соглашения на продажу билетов

import {
  DocumentType,
  checkOrganizationAgreement,
  fetchLastDocument,
  type DocumentTypeValue,
  type IAgreementDocument,
} from '@/entities/agreement';

export interface PendingOrgAgreement {
  type: DocumentTypeValue;
  document: IAgreementDocument;
}

export function orgAgreementConsentLabel(type: DocumentTypeValue): string {
  switch (type) {
    case DocumentType.OrganizationAgreement:
      return 'Принимаю договор оферты с организацией в актуальной редакции';
    case DocumentType.TicketingAgreement:
      return 'Принимаю соглашение на продажу билетов в актуальной редакции';
    default:
      return 'Принимаю условия документа';
  }
}

export function orgAgreementMissingMessage(type: DocumentTypeValue): string {
  switch (type) {
    case DocumentType.OrganizationAgreement:
      return 'Нужно принять актуальную версию договора оферты организации';
    case DocumentType.TicketingAgreement:
      return 'Для продажи билетов нужно принять актуальное соглашение на продажу билетов';
    default:
      return 'Нужно принять актуальное соглашение организации';
  }
}

/**
 * Собирает документы организации, по которым нет согласия с последней версией.
 * Если документ не опубликован на сервере, возвращает missingDocs.
 */
export async function collectOutdatedOrgAgreements(
  organizationId: string,
  opts: {
    /** Договор оферты организации (по умолчанию true) */
    requireOffer?: boolean;
    /** Соглашение на продажу билетов */
    requireTicketing?: boolean;
  } = {},
): Promise<{
  outdated: PendingOrgAgreement[];
  missingDocs: DocumentTypeValue[];
}> {
  const requireOffer = opts.requireOffer !== false;
  const requireTicketing = Boolean(opts.requireTicketing);

  const types: DocumentTypeValue[] = [];
  if (requireOffer) types.push(DocumentType.OrganizationAgreement);
  if (requireTicketing) types.push(DocumentType.TicketingAgreement);

  const outdated: PendingOrgAgreement[] = [];
  const missingDocs: DocumentTypeValue[] = [];

  for (const type of types) {
    let ok = false;
    try {
      ok = await checkOrganizationAgreement(organizationId, type);
    } catch {
      ok = false;
    }
    if (ok) continue;

    let document: IAgreementDocument | null = null;
    try {
      document = await fetchLastDocument(type);
    } catch {
      document = null;
    }
    if (!document) {
      missingDocs.push(type);
      continue;
    }
    outdated.push({ type, document });
  }

  return { outdated, missingDocs };
}
