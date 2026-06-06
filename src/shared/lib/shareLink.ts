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

export function buildUserProfileUrl(accountId: string): string {
  return `${window.location.origin}/user/${accountId}`;
}

export async function copyText(text: string): Promise<void> {
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

/** Web Share API на мобиле, иначе копирование ссылки в буфер */
export async function shareLink({ title, text, url }: ShareLinkOptions): Promise<ShareLinkResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('copy failed');

  return 'copied';
}

export function canUseNativeShare(): boolean {
  return typeof navigator.share === 'function' && window.isSecureContext;
}
