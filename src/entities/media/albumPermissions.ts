import type { IAlbum } from './albumApi';
import { isSystemAlbum } from './albumApi';

/** Можно ли добавлять фото в альбом с учётом participantsReadonly и system_kind */
export function canAddPhotosToAlbum(
  album: IAlbum,
  options: { isOrganizer: boolean; isParticipating: boolean },
): boolean {
  if (isSystemAlbum(album)) return false;
  if (options.isOrganizer) return true;
  if (album.parameters?.participantsReadonly) return false;
  return options.isParticipating;
}

/** Можно ли редактировать/удалять альбом (метаданные, удаление, ручное управление файлами) */
export function canManageAlbum(
  album: IAlbum,
  options: { isOrganizer: boolean },
): boolean {
  if (isSystemAlbum(album)) return false;
  return options.isOrganizer;
}
