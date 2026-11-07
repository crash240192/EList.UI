// AuthImage с кадром из меты файла (аватар / логотип орг).

import type { CSSProperties, ReactNode } from 'react';
import { useAvatarCropDisplay } from '@/entities/user/avatarApi';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';

interface FramedAuthImageProps {
  fileId: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
  fullSize?: boolean;
  lazy?: boolean;
}

export function FramedAuthImage({
  fileId,
  alt,
  className,
  style,
  fallback,
  fullSize,
  lazy,
}: FramedAuthImageProps) {
  const { displayFileId, imgStyle } = useAvatarCropDisplay(fileId);
  if (!displayFileId) return <>{fallback ?? null}</>;
  return (
    <AuthImage
      fileId={displayFileId}
      alt={alt}
      className={className}
      style={{ ...imgStyle, ...style }}
      fallback={fallback}
      fullSize={fullSize}
      lazy={lazy}
    />
  );
}
