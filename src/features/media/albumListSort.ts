import type { IEventAlbumsGroup } from '@/entities/media/albumApi';

/** Порядок плиток на странице «Альбомы мероприятий». */
export type AlbumListSort = 'date' | 'latestPhotos' | 'name' | 'photoCount';

export const ALBUM_LIST_SORT_OPTIONS: { id: AlbumListSort; label: string }[] = [
  { id: 'date', label: 'По дате мероприятия' },
  { id: 'latestPhotos', label: 'По последним фотографиям' },
  { id: 'name', label: 'По названию' },
  { id: 'photoCount', label: 'По количеству фотографий' },
];

export const DEFAULT_ALBUM_LIST_SORT: AlbumListSort = 'date';

function timeMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function latestPhotoMs(group: IEventAlbumsGroup): number | null {
  let best: number | null = null;
  for (const album of group.albums) {
    const ms = timeMs(album.lastContentAt);
    if (ms == null) continue;
    if (best == null || ms > best) best = ms;
  }
  return best;
}

function compareGroups(
  a: IEventAlbumsGroup,
  b: IEventAlbumsGroup,
  sort: AlbumListSort,
  photoTotals: Readonly<Record<string, number | undefined>>,
): number {
  if (sort === 'name') {
    return a.event.name.localeCompare(b.event.name, 'ru', { sensitivity: 'base' });
  }

  if (sort === 'photoCount') {
    const left = photoTotals[a.event.id];
    const right = photoTotals[b.event.id];
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right - left;
  }

  if (sort === 'latestPhotos') {
    const left = latestPhotoMs(a);
    const right = latestPhotoMs(b);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right - left;
  }

  const left = timeMs(a.event.startTime);
  const right = timeMs(b.event.startTime);
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  // Сверху более ранняя дата.
  return left - right;
}

/**
 * Не меняет альбомы внутри плитки. При равенстве оставляет прежний порядок.
 * `pinFirst` держит такие плитки выше остальных и тоже сортирует их между собой.
 */
export function sortEventAlbumGroups(
  groups: readonly IEventAlbumsGroup[],
  sort: AlbumListSort,
  photoTotals: Readonly<Record<string, number | undefined>> = {},
  pinFirst?: (group: IEventAlbumsGroup) => boolean,
): IEventAlbumsGroup[] {
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      if (pinFirst) {
        const pinned = Number(pinFirst(b.group)) - Number(pinFirst(a.group));
        if (pinned !== 0) return pinned;
      }
      const diff = compareGroups(a.group, b.group, sort, photoTotals);
      if (diff !== 0) return diff;
      return a.index - b.index;
    })
    .map(({ group }) => group);
}
