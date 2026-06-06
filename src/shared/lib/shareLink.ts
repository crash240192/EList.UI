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

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function buildSharePayloads({ title, text, url }: ShareLinkOptions): ShareData[] {
  const line = [title, text].filter(Boolean).join('\n');
  const textWithUrl = line ? `${line}\n${url}` : url;

  if (isAndroid()) {
    return [
      { text: textWithUrl },
      { url },
      { title, url },
      { title, text, url },
    ];
  }

  return [
    { url },
    { title, url },
    { text: textWithUrl },
    { title, text, url },
  ];
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

/** Первый вызов share — синхронно из обработчика клика (user activation). */
function startNativeShare(options: ShareLinkOptions): Promise<void> | null {
  if (typeof navigator.share !== 'function') return null;
  if (!window.isSecureContext) return null;

  const payloads = buildSharePayloads(options);

  for (const data of payloads) {
    try {
      return navigator.share(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  return null;
}

function tryRemainingShares(payloads: ShareData[], fromIndex: number): Promise<void> {
  if (fromIndex >= payloads.length) {
    return Promise.reject(new Error('share failed'));
  }

  const data = payloads[fromIndex];
  let promise: Promise<void>;
  try {
    promise = navigator.share!(data);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return tryRemainingShares(payloads, fromIndex + 1);
  }

  return promise.catch((err) => {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return tryRemainingShares(payloads, fromIndex + 1);
  });
}

/** Web Share API, если доступен; иначе — копирование в буфер */
export function shareLink(options: ShareLinkOptions): Promise<ShareLinkResult> {
  const payloads = buildSharePayloads(options);
  const first = startNativeShare(options);

  if (first) {
    return first
      .then(() => 'shared' as const)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        return tryRemainingShares(payloads, 1)
          .then(() => 'shared' as const)
          .catch(async (retryErr) => {
            if (retryErr instanceof DOMException && retryErr.name === 'AbortError') throw retryErr;
            await copyToClipboard(options.url);
            return 'copied' as const;
          });
      });
  }

  return copyToClipboard(options.url).then(() => 'copied' as const);
}

export function canUseNativeShare(): boolean {
  return typeof navigator.share === 'function' && window.isSecureContext;
}
