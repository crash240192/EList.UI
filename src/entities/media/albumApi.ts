// entities/media/albumApi.ts

import { apiClient } from '@/shared/api/client';
import type { PagedList } from '@/shared/api/types';

export interface IAlbumParams {
  albumId?: string;
  headAlbum?: boolean;
  participantsReadonly?: boolean;
  private?: boolean;
}

export interface IAlbum {
  id: string;
  name: string;
  description?: string;
  eventId?: string;
  accountId?: string;
  organizationId?: string;
  wallpaperId?: string;
  parameters?: IAlbumParams;
}

export interface ICreateAlbumPayload {
  name: string;
  description?: string;
  accountId?: string;
  organizationId?: string;
  parameters?: IAlbumParams;
}

/** Создать альбом. EventId не передаём — назначим через assign после создания события */
export async function createAlbum(payload: ICreateAlbumPayload): Promise<string> {
  const res = await apiClient.post<string>('/api/media/albums/create', payload);
  return (res as any).result ?? res as unknown as string;
}

/** Привязать альбом к событию */
export async function assignAlbumToEvent(eventId: string, albumId: string): Promise<void> {
  await apiClient.get(`/api/media/albums/assign/toEvent?eventId=${eventId}&albumId=${albumId}`);
}

export interface IUpdateAlbumPayload {
  id: string;
  name: string;
  description?: string;
  parameters?: IAlbumParams;
}

/** Обновить альбом */
export async function updateAlbum(payload: IUpdateAlbumPayload): Promise<void> {
  await apiClient.put('/api/media/albums/update', payload);
}

/** Удалить альбом */
export async function deleteAlbum(albumId: string): Promise<void> {
  await apiClient.delete(`/api/media/albums/${albumId}`);
}

/** Получить альбомы события */
export async function getEventAlbums(eventId: string): Promise<IAlbum[]> {
  const res = await apiClient.get<IAlbum[]>(`/api/media/albums/byEvent/${eventId}`);
  return ((res as any).result ?? res) as IAlbum[];
}

export interface IEventAlbumsEvent {
  id: string;
  startTime: string;
  name: string;
  latitude?: number;
  longitude?: number;
  colors?: string[];
}

export interface IEventAlbumsGroup {
  event: IEventAlbumsEvent;
  albums: IAlbum[];
}

/** Альбомы, сгруппированные по мероприятиям, доступные аккаунту */
export async function getAlbumsByEvents(
  accountId: string,
  pageIndex = 0,
  pageSize = 10,
): Promise<PagedList<IEventAlbumsGroup>> {
  const res = await apiClient.get<PagedList<IEventAlbumsGroup>>(
    `/api/media/albums/byEvents?accountId=${encodeURIComponent(accountId)}&pageIndex=${pageIndex}&pageSize=${pageSize}`,
  );
  return ((res as { result?: PagedList<IEventAlbumsGroup> }).result ?? res) as PagedList<IEventAlbumsGroup>;
}

export interface IAlbumFile {
  id: string;
  fileId: string;
  albumId: string;
}

/** Получить файлы альбома */
export async function getAlbumFiles(albumId: string, pageIndex = 1, pageSize = 50): Promise<IAlbumFile[]> {
  const res = await apiClient.get<any>(`/api/media/albums/${albumId}/files?pageIndex=${pageIndex}&pageSize=${pageSize}`);
  const data = (res as any).result ?? res;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
