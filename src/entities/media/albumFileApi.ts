// entities/media/albumFileApi.ts
// Привязка файлов к альбомам. Пока бэкенд не готов — заглушка с явной точкой подключения.

import { apiClient } from '@/shared/api/client';
import { uploadFile } from '@/shared/api/fileStorageClient';

/** Переключить на true, когда появится endpoint привязки файла к альбому */
const USE_ALBUM_FILE_LINK_API = false;

async function linkFileToAlbumImpl(albumId: string, fileId: string): Promise<void> {
  await apiClient.post('/api/media/albums/files/add', { albumId, fileId });
}

/** Привязать уже загруженный файл к альбому */
export async function linkFileToAlbum(albumId: string, fileId: string): Promise<void> {
  if (!USE_ALBUM_FILE_LINK_API) {
    if (import.meta.env.DEV) {
      console.info('[albumFileApi] linkFileToAlbum stub', { albumId, fileId });
    }
    return;
  }
  await linkFileToAlbumImpl(albumId, fileId);
}

/** Загрузить файл в хранилище и привязать к альбому */
export async function uploadPhotoToAlbum(albumId: string, file: File): Promise<string> {
  const { id } = await uploadFile(file);
  await linkFileToAlbum(albumId, id);
  return id;
}
