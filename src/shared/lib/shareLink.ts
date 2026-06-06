// shared/lib/shareLink.ts

export interface ShareLinkOptions {
  title: string;
  text?: string;
  url: string;
}

export type ShareLinkResult = 'shared' | 'copied';

export function buildEventShareUrl(eventId: string): string {
  return `${window.location.origin}/event/${eventId}`;
}

/** Телефоны/планшеты — нативный share; десктоп — копирование в буфер */
function prefersNativeShare(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('copy failed');
}

function canShareData(data: ShareData): boolean {
  if (!navigator.canShare) return true;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

async function tryNativeShare({ title, text, url }: ShareLinkOptions): Promise<boolean> {
  if (!navigator.share) return false;

  const payloads: ShareData[] = [
    { title, text, url },
    { title, url },
    { text: text || title, url },
    { url },
  ];

  for (const data of payloads) {
    if (!canShareData(data)) continue;
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  return false;
}

export async function shareLink(options: ShareLinkOptions): Promise<ShareLinkResult> {
  if (prefersNativeShare()) {
    const shared = await tryNativeShare(options);
    if (shared) return 'shared';
  }

  await copyToClipboard(options.url);
  return 'copied';
}
