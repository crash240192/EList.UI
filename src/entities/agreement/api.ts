// entities/agreement/api.ts
// Соглашения: анонимный возраст 18+, user/org документы Consent / Agreement / Policy / Organization / Ticketing

import { apiClient } from '@/shared/api/client';
import type {
  DocumentTypeValue,
  IAgreementDocument,
  IDocumentRequest,
} from './types';

/** Подтверждён ли возраст 18+ для текущего анонимного клиента */
export async function getAnonymousAgeAgreement(): Promise<boolean> {
  return apiClient.getStatusWithClientJwt('/api/agreements/age/anonymous/get');
}

/** Подтвердить возраст 18+ для анонимного клиента */
export async function agreeAnonymousAge(): Promise<void> {
  await apiClient.getWithClientJwt('/api/agreements/age/anonymous/agree');
}

/**
 * Актуальна ли принятая пользователем версия документа.
 * GET /api/agreements/checkUserAgreement/{documentType}
 * success === true → согласие актуально.
 */
export async function checkUserAgreement(documentType: DocumentTypeValue): Promise<boolean> {
  return apiClient.getStatus(`/api/agreements/checkUserAgreement/${documentType}`);
}

/**
 * Принять документ указанного типа.
 * GET /api/agreements/agree/{documentType}
 */
export async function agreeDocument(documentType: DocumentTypeValue): Promise<void> {
  await apiClient.get(`/api/agreements/agree/${documentType}`);
}

/**
 * Актуальна ли принятая организацией версия документа.
 * GET /api/agreements/checkOrganizationAgreement/{organizationId}/{documentType}
 */
export async function checkOrganizationAgreement(
  organizationId: string,
  documentType: DocumentTypeValue,
): Promise<boolean> {
  return apiClient.getStatus(
    `/api/agreements/checkOrganizationAgreement/${organizationId}/${documentType}`,
  );
}

/**
 * Принять документ от имени организации.
 * GET /api/agreements/agree/organization/{organizationId}/{documentType}
 */
export async function agreeOrganizationDocument(
  organizationId: string,
  documentType: DocumentTypeValue,
): Promise<void> {
  await apiClient.get(
    `/api/agreements/agree/organization/${organizationId}/${documentType}`,
  );
}

/**
 * Последняя версия документа по типу (публичный endpoint).
 * GET /api/agreements/documents/last/{documentType}
 */
export async function fetchLastDocument(documentType: DocumentTypeValue): Promise<IAgreementDocument | null> {
  const data = await apiClient.getWithClientJwt<IAgreementDocument>(
    `/api/agreements/documents/last/${documentType}`,
  );
  const raw = data.result as (IAgreementDocument & Record<string, unknown>) | null;
  if (!raw) return null;
  return normalizeDocument(raw);
}

/**
 * Последние версии всех документов (публичный endpoint).
 * GET /api/agreements/documents/last
 */
export async function fetchLastDocuments(): Promise<IAgreementDocument[]> {
  const data = await apiClient.getWithClientJwt<IAgreementDocument[]>('/api/agreements/documents/last');
  const list = data.result ?? [];
  return list.map((d) => normalizeDocument(d as IAgreementDocument & Record<string, unknown>));
}

/** POST /api/agreements/documents/add — админская загрузка документа */
export async function addAgreementDocument(payload: IDocumentRequest): Promise<void> {
  await apiClient.post('/api/agreements/documents/add', payload);
}

function normalizeDocument(raw: IAgreementDocument & Record<string, unknown>): IAgreementDocument {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    header: String(raw.header ?? raw.Header ?? ''),
    text: String(raw.text ?? raw.Text ?? ''),
    hash: String(raw.hash ?? raw.Hash ?? ''),
    type: Number(raw.type ?? raw.Type ?? 0) as DocumentTypeValue,
    version: String(raw.version ?? raw.Version ?? ''),
    creationDate: String(raw.creationDate ?? raw.CreationDate ?? ''),
  };
}
