import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IEvent } from '@/entities/event';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AlbumPhotoLightbox } from '@/features/media/AlbumPhotoLightbox';
import {
  buildEventHeroSlides,
  heroSlideKey,
  heroSlidesToLightboxSlides,
} from './eventHeroSlides';
import styles from './EventHeroCover.module.css';

const CAROUSEL_INTERVAL_MS = 6000;

interface EventHeroCoverProps {
  event: Pick<IEvent, 'coverImageId' | 'coverUrl' | 'name'>;
  headAlbumFileIds: string[];
  fallbackBackground: string;
}

export function EventHeroCover({ event, headAlbumFileIds, fallbackBackground }: EventHeroCoverProps) {
  const slides = useMemo(
    () => buildEventHeroSlides(event, headAlbumFileIds),
    [event, headAlbumFileIds],
  );
  const lightboxSlides = useMemo(() => heroSlidesToLightboxSlides(slides), [slides]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [event.coverImageId, event.coverUrl, headAlbumFileIds.join('|')]);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || paused || lightboxOpen) return;

    const timer = window.setInterval(() => {
      setActiveIndex(i => (i + 1) % slides.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [slides.length, paused, lightboxOpen]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const openLightbox = useCallback(() => {
    if (slides.length === 0) return;
    setLightboxOpen(true);
  }, [slides.length]);

  if (slides.length === 0) {
    return <div className={styles.gradient} style={{ background: fallbackBackground }} aria-hidden />;
  }

  return (
    <>
      <button
        type="button"
        className={styles.clickArea}
        onClick={openLightbox}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        aria-label="Открыть фото обложки"
      >
        {slides.map((slide, index) => (
          <div
            key={heroSlideKey(slide, index)}
            className={`${styles.slide} ${index === activeIndex ? styles.slideActive : ''}`}
            aria-hidden={index !== activeIndex}
          >
            {slide.type === 'file' ? (
              <AuthImage
                fileId={slide.fileId}
                fullSize
                imageFit="cover"
                alt={event.name}
                className={styles.slideImg}
                fallback={
                  event.coverUrl && index === 0
                    ? <img src={event.coverUrl} alt={event.name} className={styles.slideImg} />
                    : undefined
                }
              />
            ) : (
              <img src={slide.url} alt={event.name} className={styles.slideImg} />
            )}
          </div>
        ))}

        {slides.length > 1 && (
          <div className={styles.dots} aria-hidden>
            {slides.map((_, index) => (
              <span
                key={index}
                className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`}
              />
            ))}
          </div>
        )}
      </button>

      {lightboxOpen && (
        <AlbumPhotoLightbox
          slides={lightboxSlides}
          initialIdx={activeIndex}
          title={event.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
