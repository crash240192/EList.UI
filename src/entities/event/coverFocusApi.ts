import { attachFileContext, getFileInfo } from '@/shared/api/fileStorageClient';
import {
  coverZoomOf,
  DEFAULT_COVER_FOCUS,
  normalizeCoverFocus,
  parseCoverFocusFromContext,
  parseCoverFocusFromRecord,
  coverFocusFromEvent,
  serializeCoverFocusContext,
  type CoverFocus,
} from '@/shared/lib/coverFocus';

const zoomCache = new Map<string, number>();
const inFlight = new Map<string, Promise<CoverFocus | null>>();

export function rememberCoverZoom(fileId: string, zoom: number): void {
  zoomCache.set(fileId, coverZoomOf({ zoom }));
}

export function peekCoverZoom(fileId: string): number | null {
  return zoomCache.get(fileId) ?? null;
}

export async function saveCoverFocusToFile(fileId: string, focus: CoverFocus): Promise<void> {
  const next = normalizeCoverFocus(focus);
  rememberCoverZoom(fileId, next.zoom ?? 1);
  await attachFileContext(fileId, serializeCoverFocusContext(next));
}

export async function loadCoverFocusFromFile(fileId: string): Promise<CoverFocus | null> {
  const pending = inFlight.get(fileId);
  if (pending) return pending;
  const task = readCoverFocusFromFile(fileId).finally(() => {
    inFlight.delete(fileId);
  });
  inFlight.set(fileId, task);
  return task;
}

async function readCoverFocusFromFile(fileId: string): Promise<CoverFocus | null> {
  const info = await getFileInfo(fileId);
  if (!info) {
    rememberCoverZoom(fileId, 1);
    return null;
  }

  const fromDescription = parseCoverFocusFromContext(info.description);
  if (fromDescription) {
    rememberCoverZoom(fileId, coverZoomOf(fromDescription));
    return fromDescription;
  }

  if (info.metadata?.length) {
    const map: Record<string, string> = {};
    for (const item of info.metadata) {
      if (item.key) map[item.key] = item.value;
    }
    const fromMeta = parseCoverFocusFromRecord({
      coverFocusX: map.coverFocusX ?? map.CoverFocusX,
      coverFocusY: map.coverFocusY ?? map.CoverFocusY,
      ...(map.coverZoom != null || map.CoverZoom != null
        ? { coverZoom: Number(map.coverZoom ?? map.CoverZoom) }
        : {}),
    });
    if (fromMeta) {
      rememberCoverZoom(fileId, coverZoomOf(fromMeta));
      return fromMeta;
    }
  }

  rememberCoverZoom(fileId, 1);
  return null;
}

/** x/y события, если они есть, и масштаб из контекста файла. */
export async function resolveCoverFocus(
  record: {
    coverFocusX?: number | null;
    coverFocusY?: number | null;
    coverZoom?: number | null;
  } | null | undefined,
  fileId?: string | null,
): Promise<CoverFocus> {
  const fromRecord = coverFocusFromEvent(record);
  if (!fileId) return fromRecord ?? { ...DEFAULT_COVER_FOCUS };
  try {
    const fromFile = await loadCoverFocusFromFile(fileId);
    if (!fromFile) return fromRecord ?? { ...DEFAULT_COVER_FOCUS };
    return normalizeCoverFocus({
      x: fromRecord?.x ?? fromFile.x,
      y: fromRecord?.y ?? fromFile.y,
      zoom: fromFile.zoom,
    });
  } catch {
    return fromRecord ?? { ...DEFAULT_COVER_FOCUS };
  }
}
