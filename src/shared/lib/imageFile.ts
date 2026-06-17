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
