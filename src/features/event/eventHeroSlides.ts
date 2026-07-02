import type { IEvent } from '@/entities/event';
import type { PhotoLightboxSlide } from '@/features/media/AlbumPhotoLightbox';

export type EventHeroSlide =
  | { type: 'file'; fileId: string }
  | { type: 'url'; url: string };

export function buildEventHeroSlides(
  event: Pick<IEvent, 'coverImageId' | 'coverUrl'>,
  headAlbumFileIds: string[],
): EventHeroSlide[] {
  const slides: EventHeroSlide[] = [];
  const seen = new Set<string>();

  if (event.coverImageId) {
    slides.push({ type: 'file', fileId: event.coverImageId });
    seen.add(event.coverImageId);
  } else if (event.coverUrl) {
    slides.push({ type: 'url', url: event.coverUrl });
    seen.add(event.coverUrl);
  }

  for (const fileId of headAlbumFileIds) {
    if (!fileId || seen.has(fileId)) continue;
    seen.add(fileId);
    slides.push({ type: 'file', fileId });
  }

  return slides;
}

export function heroSlidesToLightboxSlides(slides: EventHeroSlide[]): PhotoLightboxSlide[] {
  return slides.map(slide =>
    slide.type === 'file'
      ? { type: 'file', fileId: slide.fileId }
      : { type: 'url', url: slide.url },
  );
}

export function heroSlideKey(slide: EventHeroSlide, index: number): string {
  if (slide.type === 'file') return `file:${slide.fileId}`;
  return `url:${slide.url}:${index}`;
}
