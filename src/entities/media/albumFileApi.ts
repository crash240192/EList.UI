// entities/media/albumFileApi.ts
// Привязка файлов к альбомам после загрузки в файлохранилище

import { apiClient } from '@/shared/api/client';
import { uploadFile } from '@/shared/api/fileStorageClient';

/** Привязать уже загруженные файлы к альбому */
export async function linkFilesToAlbum(albumId: string, fileIds: string[]): Promise<void> {
  if (!fileIds.length) return;
  await apiClient.post('/api/media/albums/addFiles', {
    albumId,
    fileIds,
  });
}

/** Привязать один файл к альбому */
export async function linkFileToAlbum(albumId: string, fileId: string): Promise<void> {
  await linkFilesToAlbum(albumId, [fileId]);
}

/** Загрузить файл в хранилище и привязать к альбому */
export async function uploadPhotoToAlbum(albumId: string, file: File): Promise<string> {
  const { id } = await uploadFile(file);
  await linkFileToAlbum(albumId, id);
  return id;
}

/** Загрузить несколько файлов и привязать к альбому одним запросом */
export async function uploadPhotosToAlbum(albumId: string, files: File[]): Promise<string[]> {
  if (!files.length) return [];
  const ids = await Promise.all(files.map(file => uploadFile(file).then(r => r.id)));
  await linkFilesToAlbum(albumId, ids);
  return ids;
}
