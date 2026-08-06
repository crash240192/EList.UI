// entities/event/eventTemplatesApi.ts
// Шаблоны создания мероприятия — тело = CreateEventRequest (swagger)

import { apiClient } from '@/shared/api/client';
import type { Gender } from '@/shared/api/types';

/** Параметры мероприятия внутри тела шаблона / create */
export interface ICreateEventParametersBody {
  cost?: number;
  private?: boolean;
  maxPersonsCount?: number | null;
  ageLimit?: number | null;
  allowedGender?: Gender | null;
  allowUsersToInvite?: boolean;
  ticketsEnabled?: boolean;
}

/** EventRequest внутри CreateEventRequest */
export interface ICreateEventBodyEvent {
  name?: string;
  description?: string | null;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  startTime?: string;
  endTime?: string | null;
  active?: boolean;
  coverImageId?: string | null;
  coverUrl?: string | null;
}

/**
 * Полное тело POST /api/events/create (и templateBody).
 * Не путать с ICreateEventRequest в types.ts (только поля самого event).
 */
export interface ICreateEventPayload {
  event?: ICreateEventBodyEvent;
  eventParameters?: ICreateEventParametersBody;
  eventTypes?: string[];
  organizatorAccountIds?: string[] | null;
  organizatorOrganizationIds?: string[] | null;
  inviteAllSubscribers?: boolean;
  inviteUsers?: string[];
  blackList?: string[];
  whiteList?: string[];
  /** API иногда принимает PascalCase */
  BlackList?: string[];
  WhiteList?: string[];
  InviteUsers?: string[];
  InviteAllSubscribers?: boolean;
}

export interface IEventTemplate {
  id: string;
  ownerAccountId: string | null;
  ownerOrganizationId: string | null;
  name: string;
  templateBody: ICreateEventPayload | null;
  createDate: string | null;
  updateDate: string | null;
}

export interface ICreateEventTemplateRequest {
  name: string;
  templateBody: ICreateEventPayload;
  organizationId?: string | null;
}

export interface IUpdateEventTemplateRequest {
  name: string;
  templateBody: ICreateEventPayload;
}

export interface IEventTemplateSearchRequest {
  organizationId?: string | null;
  name?: string | null;
}

function normalizeTemplateBody(raw: unknown): ICreateEventPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as ICreateEventPayload;
}

function normalizeTemplate(raw: Record<string, unknown>): IEventTemplate {
  const body = raw.templateBody ?? raw.TemplateBody;
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    ownerAccountId: (raw.ownerAccountId ?? raw.OwnerAccountId ?? null) as string | null,
    ownerOrganizationId: (raw.ownerOrganizationId ?? raw.OwnerOrganizationId ?? null) as string | null,
    name: String(raw.name ?? raw.Name ?? ''),
    templateBody: normalizeTemplateBody(body),
    createDate: (raw.createDate ?? raw.CreateDate ?? null) as string | null,
    updateDate: (raw.updateDate ?? raw.UpdateDate ?? null) as string | null,
  };
}

/** POST /api/eventTemplates/create → templateId */
export async function createEventTemplate(
  payload: ICreateEventTemplateRequest,
): Promise<string> {
  const r = await apiClient.post<string | null>('/api/eventTemplates/create', {
    name: payload.name,
    templateBody: payload.templateBody,
    ...(payload.organizationId ? { organizationId: payload.organizationId } : {}),
  });
  if (!r.result) throw new Error(r.message || 'Не удалось сохранить шаблон');
  return r.result;
}

/** GET /api/eventTemplates/get/{templateId} */
export async function fetchEventTemplate(templateId: string): Promise<IEventTemplate> {
  const r = await apiClient.get<Record<string, unknown>>(
    `/api/eventTemplates/get/${templateId}`,
  );
  return normalizeTemplate((r.result ?? {}) as Record<string, unknown>);
}

/** PUT /api/eventTemplates/update/{templateId} */
export async function updateEventTemplate(
  templateId: string,
  payload: IUpdateEventTemplateRequest,
): Promise<void> {
  await apiClient.put(`/api/eventTemplates/update/${templateId}`, payload);
}

/** DELETE /api/eventTemplates/delete/{templateId} */
export async function deleteEventTemplate(templateId: string): Promise<void> {
  await apiClient.delete(`/api/eventTemplates/delete/${templateId}`);
}

/**
 * POST /api/eventTemplates/search
 * Без organizationId — шаблоны текущего пользователя;
 * с organizationId — шаблоны организации.
 */
export async function searchEventTemplates(
  req: IEventTemplateSearchRequest = {},
): Promise<IEventTemplate[]> {
  const body: Record<string, unknown> = {};
  if (req.organizationId) body.organizationId = req.organizationId;
  if (req.name?.trim()) body.name = req.name.trim();

  const r = await apiClient.post<Record<string, unknown>[]>(
    '/api/eventTemplates/search',
    body,
  );
  return (r.result ?? []).map(row => normalizeTemplate(row as Record<string, unknown>));
}
