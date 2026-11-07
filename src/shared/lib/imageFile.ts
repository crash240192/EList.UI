const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  if (!file.type || file.type === 'application/octet-stream') {
    return IMAGE_EXT.test(file.name);
  }
  return false;
}

export function filterImageFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter(isImageFile);
}

/**
 * Картинки из Ctrl+V / Cmd+V.
 * Скриншот OS часто приходит как item без нормального имени (`image.png` / `blob`).
 */
export function filesFromClipboard(clipboard: DataTransfer | null | undefined): File[] {
  if (!clipboard) return [];

  const fromItems: File[] = [];
  if (clipboard.items?.length) {
    for (const item of Array.from(clipboard.items)) {
      if (item.kind !== 'file') continue;
      // type может быть пустым — проверяем сам File
      if (item.type && !item.type.startsWith('image/') && item.type !== 'application/octet-stream') {
        continue;
      }
      const raw = item.getAsFile();
      if (!raw || !isImageFile(raw)) continue;

      const mime = raw.type && raw.type.startsWith('image/')
        ? raw.type
        : (item.type.startsWith('image/') ? item.type : 'image/png');
      const ext = mime === 'image/jpeg' ? 'jpg'
        : mime === 'image/webp' ? 'webp'
          : mime === 'image/gif' ? 'gif'
            : 'png';
      const name = raw.name && raw.name !== 'image.png' && raw.name !== 'blob'
        ? raw.name
        : `screenshot-${Date.now()}-${fromItems.length + 1}.${ext}`;
      fromItems.push(
        raw.name === name && raw.type
          ? raw
          : new File([raw], name, { type: mime }),
      );
    }
  }
  if (fromItems.length) return fromItems;

  return filterImageFiles(clipboard.files ?? []);
}
