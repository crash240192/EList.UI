import type { IAlbum } from './albumApi';

/** Можно ли добавлять фото в альбом с учётом participantsReadonly */
export function canAddPhotosToAlbum(
  album: IAlbum,
  options: { isOrganizer: boolean; isParticipating: boolean },
): boolean {
  if (options.isOrganizer) return true;
  if (album.parameters?.participantsReadonly) return false;
  return options.isParticipating;
}
