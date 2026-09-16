// entities/media/albumApi.ts

import { apiClient } from '@/shared/api/client';
import type { PagedList } from '@/shared/api/types';
import type { EventListItemData } from '@/entities/event/lib/eventListItemUtils';
import { normalizeEventListItem } from '@/entities/event/normalizeEventListItem';
import { fetchEventParameters } from '@/entities/event/eventExtrasApi';
import { fetchEvents } from '@/entities/event/api';

export interface IAlbumParams {
  albumId?: string;
  headAlbum?: boolean;
  participantsReadonly?: boolean;
  private?: boolean;
  /** 1 = DiscussionPhotos и т.п.; null/undefined — обычный альбом */
  systemKind?: number | null;
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

export function isSystemAlbum(album: IAlbum | null | undefined): boolean {
  return album?.parameters?.systemKind != null;
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

function normalizeAlbumParams(raw: unknown): IAlbumParams | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const systemRaw = r.systemKind ?? r.SystemKind;
  return {
    albumId: r.albumId != null || r.AlbumId != null ? String(r.albumId ?? r.AlbumId) : undefined,
    headAlbum: Boolean(r.headAlbum ?? r.HeadAlbum),
    participantsReadonly: Boolean(r.participantsReadonly ?? r.ParticipantsReadonly),
    private: Boolean(r.private ?? r.Private),
    systemKind: systemRaw == null || systemRaw === '' ? null : Number(systemRaw),
  };
}

function normalizeAlbum(raw: unknown): IAlbum {
  const r = (raw ?? {}) as Record<string, unknown>;
  const params = normalizeAlbumParams(r.parameters ?? r.Parameters);
  return {
    id: String(r.id ?? r.Id ?? ''),
    name: String(r.name ?? r.Name ?? ''),
    description: r.description != null || r.Description != null
      ? String(r.description ?? r.Description)
      : undefined,
    eventId: r.eventId != null || r.EventId != null ? String(r.eventId ?? r.EventId) : undefined,
    accountId: r.accountId != null || r.AccountId != null ? String(r.accountId ?? r.AccountId) : undefined,
    organizationId: r.organizationId != null || r.OrganizationId != null
      ? String(r.organizationId ?? r.OrganizationId)
      : undefined,
    wallpaperId: r.wallpaperId != null || r.WallpaperId != null
      ? String(r.wallpaperId ?? r.WallpaperId)
      : undefined,
    parameters: params,
  };
}

/** Получить альбомы события */
export async function getEventAlbums(eventId: string): Promise<IAlbum[]> {
  const res = await apiClient.get<IAlbum[]>(`/api/media/albums/byEvent/${eventId}`);
  const list = ((res as any).result ?? res) as unknown[];
  return Array.isArray(list) ? list.map(normalizeAlbum) : [];
}

export interface IEventAlbumsGroup {
  event: EventListItemData;
  albums: IAlbum[];
}

function normalizeAlbumsGroup(raw: unknown): IEventAlbumsGroup {
  const row = (raw ?? {}) as Record<string, unknown>;
  const event = row.event ?? row.Event;
  const albumsRaw = row.albums ?? row.Albums;
  const albums = Array.isArray(albumsRaw) ? albumsRaw.map(normalizeAlbum) : [];
  return {
    event: normalizeEventListItem(event),
    albums,
  };
}

async function enrichAlbumGroupsWithParameters(groups: IEventAlbumsGroup[]): Promise<IEventAlbumsGroup[]> {
  const missing = groups.filter(g => g.event.id && g.event.parameters?.ageLimit == null);
  if (missing.length === 0) return groups;

  const eventIds = [...new Set(missing.map(g => g.event.id))];
  const paramsByEvent = new Map<string, Awaited<ReturnType<typeof fetchEventParameters>>>();

  await Promise.all(eventIds.map(async eventId => {
    paramsByEvent.set(eventId, await fetchEventParameters(eventId));
  }));

  return groups.map(group => {
    if (group.event.parameters?.ageLimit != null) return group;

    const params = paramsByEvent.get(group.event.id);
    if (!params) return group;

    return {
      ...group,
      event: {
        ...group.event,
        parameters: {
          cost: params.cost ?? group.event.parameters?.cost ?? 0,
          ageLimit: params.ageLimit,
          maxPersonsCount: params.maxPersonsCount ?? group.event.parameters?.maxPersonsCount ?? null,
        },
      },
    };
  });
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
  const data = ((res as { result?: PagedList<IEventAlbumsGroup> }).result ?? res) as PagedList<IEventAlbumsGroup>;
  const groups = Array.isArray(data.result) ? data.result.map(normalizeAlbumsGroup) : [];
  const enriched = await enrichAlbumGroupsWithParameters(groups);
  return {
    ...data,
    result: enriched,
  };
}

/**
 * Альбомы мероприятий организации: обходим события org и подтягиваем альбомы.
 * В swagger нет byEvents?organizationId — собираем группы на клиенте.
 */
export async function getAlbumsByOrganizationEvents(
  organizationId: string,
  pageIndex = 0,
  pageSize = 10,
): Promise<PagedList<IEventAlbumsGroup>> {
  const EVENT_SCAN_SIZE = Math.max(pageSize * 3, 20);
  const collected: IEventAlbumsGroup[] = [];
  let eventPage = 0;
  let eventsTotal = 0;
  let scanned = 0;
  const skip = pageIndex * pageSize;

  while (collected.length < skip + pageSize) {
    const eventsPage = await fetchEvents({
      organizationId,
      pageIndex: eventPage,
      pageSize: EVENT_SCAN_SIZE,
    });
    eventsTotal = eventsPage.total;
    const batch = eventsPage.result ?? [];
    if (batch.length === 0) break;

    const groups = await Promise.all(
      batch.map(async (event) => {
        const albums = await getEventAlbums(event.id).catch(() => [] as IAlbum[]);
        if (!albums.length) return null;
        return {
          event: normalizeEventListItem(event),
          albums,
        } satisfies IEventAlbumsGroup;
      }),
    );

    for (const g of groups) {
      if (g) collected.push(g);
    }

    scanned += batch.length;
    eventPage += 1;
    if (scanned >= eventsTotal || batch.length < EVENT_SCAN_SIZE) break;
  }

  const pageGroups = collected.slice(skip, skip + pageSize);
  const enriched = await enrichAlbumGroupsWithParameters(pageGroups);

  // Пока не просканировали все события — total как нижняя граница + «есть ещё»
  const exhausted = scanned >= eventsTotal;
  const total = exhausted
    ? collected.length
    : Math.max(collected.length, skip + pageGroups.length + (pageGroups.length === pageSize ? 1 : 0));

  return {
    pageIndex,
    pageSize,
    total,
    result: enriched,
  };
}

export interface IAlbumFile {
  id: string;
  fileId: string;
  albumId: string;
}

/** Получить файлы альбома */
export async function getAlbumFiles(albumId: string, pageIndex = 1, pageSize = 50): Promise<IAlbumFile[]> {
  const res = await apiClient.get<any>(`/api/media/albums/filesByAlbumId/${albumId}?pageIndex=${pageIndex}&pageSize=${pageSize}`);
  const data = (res as any).result ?? res;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
