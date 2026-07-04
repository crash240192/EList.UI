import { useEffect, useState } from 'react';
import { getAlbumFiles, getEventAlbums } from '@/entities/media/albumApi';

/** Фотографии из альбома мероприятия с parameters.headAlbum === true */
export function useEventHeadAlbumPhotos(eventId: string | undefined): string[] {
  const [fileIds, setFileIds] = useState<string[]>([]);

  useEffect(() => {
    if (!eventId) {
      setFileIds([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const albums = await getEventAlbums(eventId);
        const headAlbum = albums.find(a => a.parameters?.headAlbum === true);
        if (!headAlbum) {
          if (!cancelled) setFileIds([]);
          return;
        }

        const files = await getAlbumFiles(headAlbum.id, 1, 100);
        if (!cancelled) {
          setFileIds(files.map(f => f.fileId).filter(Boolean));
        }
      } catch {
        if (!cancelled) setFileIds([]);
      }
    })();

    return () => { cancelled = true; };
  }, [eventId]);

  return fileIds;
}
