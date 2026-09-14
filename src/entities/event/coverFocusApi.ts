import { attachFileContext, getFileInfo } from '@/shared/api/fileStorageClient';
import {
  parseCoverFocusFromContext,
  parseCoverFocusFromRecord,
  serializeCoverFocusContext,
  type CoverFocus,
} from '@/shared/lib/coverFocus';

export async function saveCoverFocusToFile(fileId: string, focus: CoverFocus): Promise<void> {
  await attachFileContext(fileId, serializeCoverFocusContext(focus));
}

export async function loadCoverFocusFromFile(fileId: string): Promise<CoverFocus | null> {
  const info = await getFileInfo(fileId);
  if (!info) return null;

  const fromDescription = parseCoverFocusFromContext(info.description);
  if (fromDescription) return fromDescription;

  if (info.metadata?.length) {
    const map: Record<string, string> = {};
    for (const item of info.metadata) {
      if (item.key) map[item.key] = item.value;
    }
    const fromMeta = parseCoverFocusFromRecord({
      coverFocusX: map.coverFocusX ?? map.CoverFocusX,
      coverFocusY: map.coverFocusY ?? map.CoverFocusY,
    });
    if (fromMeta) return fromMeta;
  }

  return null;
}
