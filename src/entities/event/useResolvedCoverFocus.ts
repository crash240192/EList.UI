import { useEffect, useState } from 'react';
import { loadCoverFocusFromFile, peekCoverZoom } from '@/entities/event/coverFocusApi';
import {
  coverFocusFromEvent,
  coverZoomOf,
  DEFAULT_COVER_FOCUS,
  type CoverFocus,
} from '@/shared/lib/coverFocus';

interface CoverFocusSource {
  coverImageId?: string | null;
  coverFocusX?: number | null;
  coverFocusY?: number | null;
  coverZoom?: number | null;
}

/**
 * Масштаб обложки лежит в контексте файла, поиск его не отдаёт.
 * Пока файл не прочитан, кадр как cover (zoom 1). Повторные карточки берут кэш.
 */
export function useResolvedCoverFocus(source: CoverFocusSource | null | undefined): CoverFocus {
  const base = coverFocusFromEvent(source) ?? DEFAULT_COVER_FOCUS;
  const fileId = source?.coverImageId ?? null;
  const knownZoom = source?.coverZoom;
  const [fileZoom, setFileZoom] = useState<number | null>(() => {
    if (knownZoom != null) return coverZoomOf({ zoom: knownZoom });
    if (fileId) return peekCoverZoom(fileId);
    return null;
  });

  useEffect(() => {
    if (knownZoom != null) {
      setFileZoom(coverZoomOf({ zoom: knownZoom }));
      return;
    }
    if (!fileId) {
      setFileZoom(null);
      return;
    }
    const cached = peekCoverZoom(fileId);
    if (cached != null) {
      setFileZoom(cached);
      return;
    }
    let cancelled = false;
    void loadCoverFocusFromFile(fileId).then(focus => {
      if (!cancelled) setFileZoom(focus ? coverZoomOf(focus) : 1);
    }).catch(() => {
      if (!cancelled) setFileZoom(1);
    });
    return () => { cancelled = true; };
  }, [fileId, knownZoom]);

  return { x: base.x, y: base.y, zoom: fileZoom ?? base.zoom };
}
