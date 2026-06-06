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

function buildSharePayloads({ title, text, url }: ShareLinkOptions): ShareData[] {
  const payloads: ShareData[] = [{ url }];

  if (title) payloads.push({ title, url });
  if (text) payloads.push({ text, url });
  if (title && text) payloads.push({ title, text, url });

  return payloads;
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

/**
 * navigator.share нужно вызвать синхронно из обработчика клика (user activation).
 * На Android цепочка async/await до вызова share часто приводит к fallback в буфер.
 */
function startNativeShare(options: ShareLinkOptions): Promise<void> | null {
  if (typeof navigator.share !== 'function') return null;

  const payloads = buildSharePayloads(options);
  let lastError: unknown;

  for (const data of payloads) {
    try {
      return navigator.share(data);
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') throw lastError;
  return null;
}

/** Web Share API на любой платформе, если доступен; иначе — копирование в буфер */
export function shareLink(options: ShareLinkOptions): Promise<ShareLinkResult> {
  const sharePromise = startNativeShare(options);

  if (sharePromise) {
    return sharePromise
      .then(() => 'shared' as const)
      .catch(async (err) => {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        await copyToClipboard(options.url);
        return 'copied' as const;
      });
  }

  return copyToClipboard(options.url).then(() => 'copied' as const);
}
