// entities/media/albumApi.ts

import { apiClient } from '@/shared/api/client';

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

/** Удалить альбом */
export async function deleteAlbum(albumId: string): Promise<void> {
  await apiClient.delete(`/api/media/albums/${albumId}`);
}

/** Получить альбомы события */
export async function getEventAlbums(eventId: string): Promise<IAlbum[]> {
  const res = await apiClient.get<IAlbum[]>(`/api/media/albums/byEvent/${eventId}`);
  return ((res as any).result ?? res) as IAlbum[];
}

export interface IAlbumFile {
  id: string;
  fileId: string;
  albumId: string;
}

/** Получить файлы альбома */
export async function getAlbumFiles(albumId: string, pageIndex = 1, pageSize = 50): Promise<IAlbumFile[]> {
  const res = await apiClient.get<any>(`/api/media/albums/${albumId}/files?pageIndex=${pageIndex}&pageSize=${pageSize}`);
  const paged = (res as any).result ?? res;
  return paged.result ?? [];
}
