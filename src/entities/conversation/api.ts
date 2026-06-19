import { apiClient } from '@/shared/api/client';
import { textLengthError } from '@/shared/lib/clampText';
import { DISCUSSION_MESSAGE_MAX_LENGTH } from '@/shared/lib/textLimits';
import type { PagedList } from '@/shared/api/types';
import type { IConversation, IConversationRequest, IMessage, IMessageRequest } from './types';

const PAGE_SIZE_DEFAULT = 20;

export async function createConversation(request: IConversationRequest): Promise<string> {
  const data = await apiClient.post<string>('/api/conversations/create', request);
  return data.result;
}

export async function updateConversation(request: IConversationRequest): Promise<void> {
  await apiClient.put('/api/conversations/update', request);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await apiClient.delete(`/api/conversations/delete/${conversationId}`);
}

export async function fetchConversation(conversationId: string): Promise<IConversation> {
  const data = await apiClient.get<IConversation>(`/api/conversations/get/${conversationId}`);
  return data.result;
}

export async function fetchEventConversations(eventId: string): Promise<IConversation[]> {
  const data = await apiClient.get<IConversation[]>(`/api/conversations/byEvent/${eventId}`);
  return data.result ?? [];
}

export async function fetchConversationMessages(
  conversationId: string,
  pageIndex = 0,
  pageSize = PAGE_SIZE_DEFAULT,
): Promise<PagedList<IMessage>> {
  const qs = `pageIndex=${pageIndex}&pageSize=${pageSize}`;
  const data = await apiClient.get<PagedList<IMessage>>(
    `/api/conversations/messages/${conversationId}?${qs}`,
  );
  return data.result;
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
  return data.result;
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
