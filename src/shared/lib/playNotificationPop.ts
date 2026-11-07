// shared/lib/playNotificationPop.ts
// Web Audio вместо HTMLAudioElement: на мобилке <audio> берёт media session
// (Gain / ducking) и часто не отпускает громкость других приложений, пока вкладка жива.

const SOUND_URL = `${import.meta.env.BASE_URL}sounds/notification.mp3`;
const VOLUME = 0.35;

type AudioSessionLike = { type: string };

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let bufferPromise: Promise<AudioBuffer | null> | null = null;
let unlockBound = false;

function getAudioSession(): AudioSessionLike | null {
  const nav = navigator as Navigator & { audioSession?: AudioSessionLike };
  return nav.audioSession ?? null;
}

function getCtx(): AudioContext {
  if (!ctx) {
    const AC =
      window.AudioContext
      ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

function loadBuffer(): Promise<AudioBuffer | null> {
  if (buffer) return Promise.resolve(buffer);
  if (!bufferPromise) {
    bufferPromise = (async () => {
      try {
        const res = await fetch(SOUND_URL);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        // decodeAudioData может забрать буфер — отдаём копию
        const decoded = await getCtx().decodeAudioData(data.slice(0));
        buffer = decoded;
        return decoded;
      } catch {
        return null;
      }
    })();
  }
  return bufferPromise;
}

/** Браузеры требуют жест пользователя перед воспроизведением */
export function ensureNotificationSoundUnlocked(): void {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;

  const unlock = () => {
    try {
      const c = getCtx();
      void c.resume().then(() => {
        void loadBuffer();
      });
    } catch {
      /* ignore */
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

/** Звук уведомления (public/sounds/notification.mp3) через Web Audio */
export function playNotificationPop(): void {
  if (typeof window === 'undefined') return;

  void (async () => {
    try {
      const c = getCtx();
      if (c.state === 'suspended') {
        await c.resume();
      }
      const buf = await loadBuffer();
      if (!buf) return;

      const session = getAudioSession();
      const prevType = session?.type;
      // transient — короткий звук, должен отпускать ducking других приложений
      if (session) session.type = 'transient';

      const gain = c.createGain();
      gain.gain.value = VOLUME;
      gain.connect(c.destination);

      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(gain);

      const cleanup = () => {
        try {
          src.disconnect();
          gain.disconnect();
        } catch {
          /* already disconnected */
        }
        if (session) {
          session.type = prevType && prevType !== 'transient' ? prevType : 'auto';
        }
      };

      src.onended = cleanup;
      src.start(0);
    } catch {
      /* autoplay policy / decode */
    }
  })();
}
