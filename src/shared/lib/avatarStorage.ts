// Хранение fileId аватара в localStorage по accountId
const PREFIX = 'elist_avatar_id_';

export function getAvatarFileId(accountId: string): string | null {
  return localStorage.getItem(PREFIX + accountId);
}

export function setAvatarFileId(accountId: string, fileId: string): void {
  localStorage.setItem(PREFIX + accountId, fileId);
}
