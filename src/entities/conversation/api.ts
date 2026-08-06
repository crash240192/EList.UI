import { apiClient } from '@/shared/api/client';
import { textLengthError } from '@/shared/lib/clampText';
import { DISCUSSION_MESSAGE_MAX_LENGTH } from '@/shared/lib/textLimits';
import type { PagedList } from '@/shared/api/types';
import type { IConversation, IConversationRequest, IMessage, IMessageRequest } from './types';

const PAGE_SIZE_DEFAULT = 20;

type RawPagedList<T> = PagedList<T> & {
  Total?: number;
  Result?: T[];
  PageIndex?: number;
  PageSize?: number;
};

function normalizePagedList<T>(
  raw: RawPagedList<T> | null | undefined,
  pageIndex: number,
  pageSize: number,
): PagedList<T> {
  const items = raw?.result ?? raw?.Result ?? [];
  return {
    pageIndex: raw?.pageIndex ?? raw?.PageIndex ?? pageIndex,
    pageSize: raw?.pageSize ?? raw?.PageSize ?? pageSize,
    total: raw?.total ?? raw?.Total ?? items.length,
    result: items,
  };
}

function normalizeConversation(raw: Record<string, unknown>): IConversation {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    eventId: (raw.eventId ?? raw.EventId ?? null) as string | null,
    participantsOnlyVisible: Boolean(
      raw.participantsOnlyVisible ?? raw.ParticipantsOnlyVisible ?? false,
    ),
    participantsReadonly: Boolean(
      raw.participantsReadonly ?? raw.ParticipantsReadonly ?? false,
    ),
    createDate: String(raw.createDate ?? raw.CreateDate ?? ''),
    updateDate: String(raw.updateDate ?? raw.UpdateDate ?? ''),
  };
}

export async function createConversation(request: IConversationRequest): Promise<string> {
  const data = await apiClient.post<string>('/api/conversations/create', {
    name: request.name,
    ...(request.eventId ? { eventId: request.eventId } : {}),
    participantsOnlyVisible: Boolean(request.participantsOnlyVisible),
    participantsReadonly: Boolean(request.participantsReadonly),
  });
  return data.result;
}

export async function updateConversation(request: IConversationRequest): Promise<void> {
  await apiClient.put('/api/conversations/update', {
    id: request.id,
    name: request.name,
    ...(request.eventId ? { eventId: request.eventId } : {}),
    participantsOnlyVisible: Boolean(request.participantsOnlyVisible),
    participantsReadonly: Boolean(request.participantsReadonly),
  });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await apiClient.delete(`/api/conversations/delete/${conversationId}`);
}

export async function fetchConversation(conversationId: string): Promise<IConversation> {
  const data = await apiClient.get<Record<string, unknown>>(
    `/api/conversations/get/${conversationId}`,
  );
  return normalizeConversation((data.result ?? {}) as Record<string, unknown>);
}

export async function fetchEventConversations(eventId: string): Promise<IConversation[]> {
  const data = await apiClient.get<Record<string, unknown>[]>(
    `/api/conversations/byEvent/${eventId}`,
  );
  return (data.result ?? []).map(row =>
    normalizeConversation(row as Record<string, unknown>),
  );
}

export async function fetchConversationMessages(
  conversationId: string,
  pageIndex = 0,
  pageSize = PAGE_SIZE_DEFAULT,
): Promise<PagedList<IMessage>> {
  const qs = `pageIndex=${pageIndex}&pageSize=${pageSize}`;
  const data = await apiClient.get<PagedList<IMessage>>(
    `/api/conversations/messages/byConversationId/${conversationId}?${qs}`,
  );
  return normalizePagedList(data.result, pageIndex, pageSize);
}

export async function fetchMessageReplies(
  messageId: string,
  pageIndex = 0,
  pageSize = PAGE_SIZE_DEFAULT,
): Promise<PagedList<IMessage>> {
  const qs = `pageIndex=${pageIndex}&pageSize=${pageSize}`;
  const data = await apiClient.get<PagedList<IMessage>>(
    `/api/conversations/messages/replies/${messageId}?${qs}`,
  );
  return normalizePagedList(data.result, pageIndex, pageSize);
}

export async function createMessage(request: IMessageRequest): Promise<string> {
  const lengthError = textLengthError(request.messageText.trim().length, DISCUSSION_MESSAGE_MAX_LENGTH);
  if (lengthError) throw new Error(lengthError);
  const data = await apiClient.post<string>('/api/conversations/messages/create', request);
  return data.result;
}

export async function updateMessage(request: IMessageRequest): Promise<void> {
  const lengthError = textLengthError(request.messageText.trim().length, DISCUSSION_MESSAGE_MAX_LENGTH);
  if (lengthError) throw new Error(lengthError);
  await apiClient.put('/api/conversations/messages/update', request);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiClient.delete(`/api/conversations/messages/${messageId}`);
}
