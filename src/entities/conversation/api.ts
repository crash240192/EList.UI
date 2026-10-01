import { apiClient } from '@/shared/api/client';
import { textLengthError } from '@/shared/lib/clampText';
import { DISCUSSION_MESSAGE_MAX_LENGTH } from '@/shared/lib/textLimits';
import type { PagedList } from '@/shared/api/types';
import type {
  IConversation,
  IConversationRequest,
  IMessage,
  IMessageLocation,
  IMessagePathNode,
  IMessageRequest,
  IMessageVoteResult,
  MessageVoteValue,
} from './types';

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

function normalizeMessageVote(raw: unknown): MessageVoteValue | null {
  if (raw == null || raw === '') return null;
  // Reject arrays/objects (broken serializers) and numeric 0 (C# default enum footgun).
  if (typeof raw === 'object') return null;
  if (typeof raw === 'number') {
    if (raw === 1) return 'like';
    if (raw === 2) return 'dislike';
    return null;
  }
  const s = String(raw).trim().toLowerCase();
  if (s === 'like') return 'like';
  if (s === 'dislike') return 'dislike';
  return null;
}

function normalizeFileIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function normalizeMessage(raw: unknown): IMessage {
  const r = (raw ?? {}) as Record<string, unknown>;
  const msg = (raw ?? {}) as IMessage;
  return {
    ...msg,
    id: String(r.id ?? r.Id ?? msg.id ?? ''),
    conversationId: String(r.conversationId ?? r.ConversationId ?? msg.conversationId ?? ''),
    messageText: String(r.messageText ?? r.MessageText ?? msg.messageText ?? ''),
    replied: Boolean(r.replied ?? r.Replied ?? msg.replied),
    hidden: Boolean(r.hidden ?? r.Hidden ?? msg.hidden),
    likesCount: Number(r.likesCount ?? r.LikesCount ?? msg.likesCount ?? 0) || 0,
    dislikesCount: Number(r.dislikesCount ?? r.DislikesCount ?? msg.dislikesCount ?? 0) || 0,
    currentUserVote: normalizeMessageVote(r.currentUserVote ?? r.CurrentUserVote ?? msg.currentUserVote),
    fileIds: normalizeFileIds(r.fileIds ?? r.FileIds ?? msg.fileIds),
  };
}

function normalizeMessageVoteResult(raw: unknown): IMessageVoteResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    messageId: String(r.messageId ?? r.MessageId ?? ''),
    likesCount: Number(r.likesCount ?? r.LikesCount ?? 0) || 0,
    dislikesCount: Number(r.dislikesCount ?? r.DislikesCount ?? 0) || 0,
    currentUserVote: normalizeMessageVote(r.currentUserVote ?? r.CurrentUserVote),
  };
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
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return { ...page, result: page.result.map(normalizeMessage) };
}

/** Корневые комментарии диалога (ReplyTo IS NULL) */
export async function fetchConversationRootMessages(
  conversationId: string,
  pageIndex = 0,
  pageSize = PAGE_SIZE_DEFAULT,
): Promise<PagedList<IMessage>> {
  const qs = `pageIndex=${pageIndex}&pageSize=${pageSize}`;
  const data = await apiClient.get<PagedList<IMessage>>(
    `/api/conversations/messages/roots/byConversationId/${conversationId}?${qs}`,
  );
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return { ...page, result: page.result.map(normalizeMessage) };
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
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return { ...page, result: page.result.map(normalizeMessage) };
}

function normalizePathNode(raw: unknown): IMessagePathNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const messageId = String(r.messageId ?? r.MessageId ?? '');
  if (!messageId) return null;
  const parentRaw = r.parentId ?? r.ParentId;
  return {
    messageId,
    parentId: parentRaw == null || parentRaw === '' ? null : String(parentRaw),
    pageIndex: Number(r.pageIndex ?? r.PageIndex ?? 0) || 0,
  };
}

function normalizeMessageLocation(raw: unknown): IMessageLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const messageId = String(r.messageId ?? r.MessageId ?? '');
  const conversationId = String(r.conversationId ?? r.ConversationId ?? '');
  if (!messageId || !conversationId) return null;

  const pathRaw = (r.path ?? r.Path ?? []) as unknown[];
  const path = pathRaw
    .map(normalizePathNode)
    .filter((n): n is IMessagePathNode => n != null);

  const ancestorsRaw = (r.ancestorIds ?? r.AncestorIds ?? []) as unknown[];
  const ancestorIds = ancestorsRaw.map((id) => String(id)).filter(Boolean);

  const eventRaw = r.eventId ?? r.EventId;
  const parentRaw = r.parentId ?? r.ParentId;
  const rootId = String(r.rootId ?? r.RootId ?? path[0]?.messageId ?? messageId);

  return {
    messageId,
    conversationId,
    eventId: eventRaw == null || eventRaw === '' ? null : String(eventRaw),
    rootId,
    parentId: parentRaw == null || parentRaw === '' ? null : String(parentRaw),
    path,
    ancestorIds,
    rootPageIndex: Number(r.rootPageIndex ?? r.RootPageIndex ?? path[0]?.pageIndex ?? 0) || 0,
    siblingPageIndex: Number(r.siblingPageIndex ?? r.SiblingPageIndex ?? 0) || 0,
  };
}

/** Путь и индексы страниц для прокрутки к комментарию (уведомления / deep-link) */
export async function fetchMessageLocation(
  messageId: string,
  options?: { rootPageSize?: number; siblingPageSize?: number },
): Promise<IMessageLocation | null> {
  const qs = new URLSearchParams();
  if (options?.rootPageSize != null) qs.set('rootPageSize', String(options.rootPageSize));
  if (options?.siblingPageSize != null) qs.set('siblingPageSize', String(options.siblingPageSize));
  const q = qs.toString();
  const data = await apiClient.get<unknown>(
    `/api/conversations/messages/${messageId}/location${q ? `?${q}` : ''}`,
  );
  return normalizeMessageLocation(data.result);
}

export async function createMessage(request: IMessageRequest): Promise<string> {
  const text = (request.messageText ?? '').trim();
  const fileIds = (request.fileIds ?? []).filter(Boolean);
  if (!text && fileIds.length === 0) {
    throw new Error('Сообщение должно содержать текст или фото');
  }
  const lengthError = textLengthError(text.length, DISCUSSION_MESSAGE_MAX_LENGTH);
  if (lengthError) throw new Error(lengthError);
  if (fileIds.length > 10) throw new Error('Не больше 10 фото на комментарий');
  const data = await apiClient.post<string>('/api/conversations/messages/create', {
    ...request,
    messageText: text,
    fileIds: fileIds.length ? fileIds : undefined,
  });
  return data.result;
}

export async function updateMessage(request: IMessageRequest): Promise<void> {
  const text = (request.messageText ?? '').trim();
  const fileIds = request.fileIds;
  if (fileIds != null && fileIds.length === 0 && !text) {
    throw new Error('Сообщение должно содержать текст или фото');
  }
  const lengthError = textLengthError(text.length, DISCUSSION_MESSAGE_MAX_LENGTH);
  if (lengthError) throw new Error(lengthError);
  if (fileIds != null && fileIds.length > 10) throw new Error('Не больше 10 фото на комментарий');
  await apiClient.put('/api/conversations/messages/update', {
    ...request,
    messageText: text,
  });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiClient.delete(`/api/conversations/messages/${messageId}`);
}

export async function likeMessage(messageId: string): Promise<IMessageVoteResult> {
  const data = await apiClient.post<unknown>(`/api/conversations/messages/${messageId}/like`);
  return normalizeMessageVoteResult(data.result);
}

export async function dislikeMessage(messageId: string): Promise<IMessageVoteResult> {
  const data = await apiClient.post<unknown>(`/api/conversations/messages/${messageId}/dislike`);
  return normalizeMessageVoteResult(data.result);
}

export async function removeMessageVote(messageId: string): Promise<IMessageVoteResult> {
  const data = await apiClient.delete<unknown>(`/api/conversations/messages/${messageId}/vote`);
  return normalizeMessageVoteResult(data.result);
}
