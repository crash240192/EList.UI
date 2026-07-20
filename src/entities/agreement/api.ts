// entities/agreement/api.ts
// Соглашения: анонимный возраст 18+ и документы Consent / Agreement / Policy

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

function documentTypeQuery(documentType: DocumentTypeValue): string {
  return `documentType=${encodeURIComponent(String(documentType))}`;
}

/**
 * Актуальна ли принятая пользователем версия документа.
 * GET /api/agreements/checkUserAgreement?documentType=
 * success === true → согласие актуально.
 */
export async function checkUserAgreement(documentType: DocumentTypeValue): Promise<boolean> {
  return apiClient.getStatus(`/api/agreements/checkUserAgreement?${documentTypeQuery(documentType)}`);
}

/**
 * Принять документ указанного типа.
 * GET /api/agreements/agree?documentType=
 */
export async function agreeDocument(documentType: DocumentTypeValue): Promise<void> {
  await apiClient.get(`/api/agreements/agree?${documentTypeQuery(documentType)}`);
}

/**
 * Последняя версия документа по типу.
 * GET /api/agreements/documents/last/{type}
 */
export async function fetchLastDocument(type: DocumentTypeValue): Promise<IAgreementDocument | null> {
  const data = await apiClient.get<IAgreementDocument>(`/api/agreements/documents/last/${type}`);
  const raw = data.result as (IAgreementDocument & Record<string, unknown>) | null;
  if (!raw) return null;
  return normalizeDocument(raw);
}

/**
 * Последние версии всех документов.
 * GET /api/agreements/documents/last
 */
export async function fetchLastDocuments(): Promise<IAgreementDocument[]> {
  const data = await apiClient.get<IAgreementDocument[]>('/api/agreements/documents/last');
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
