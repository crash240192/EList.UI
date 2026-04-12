// entities/event/participationApi.ts
// Методы участия в мероприятии
// Все три — GET-запросы согласно swagger

import { apiClient } from '@/shared/api/client';

export interface IParticipant {
  id: string;           // accountId участника
  login?: string;
  // Дополнительные поля если API возвращает расширенную модель
}

/**
 * Записаться на мероприятие.
 * GET /api/participations/participate/{id}
 */
export async function participateEvent(eventId: string): Promise<void> {
  await apiClient.get(`/api/participations/participate/${eventId}`);
}

/**
 * Покинуть мероприятие.
 * GET /api/participations/leave/{id}
 */
export async function leaveEvent(eventId: string): Promise<void> {
  await apiClient.get(`/api/participations/leave/${eventId}`);
}

/**
 * Получить список участников мероприятия.
 * GET /api/participations/eventParticipants/{id}
 * Возвращает массив участников (структура уточняется по реальному ответу API).
 */
export async function fetchEventParticipants(eventId: string): Promise<IParticipant[]> {
  // API возвращает CommandResult<unknown> — обрабатываем гибко
  const data = await apiClient.get<IParticipant[] | string[]>(`/api/participations/eventParticipants/${eventId}`);

  const result = data.result;
  if (!result || !Array.isArray(result)) return [];

  // Если сервер вернул массив строк (UUID) — нормализуем в объекты
  if (typeof result[0] === 'string') {
    return (result as string[]).map(id => ({ id }));
  }

  return result as IParticipant[];
}
