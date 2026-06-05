// shared/lib/playNotificationPop.ts

const SOUND_URL = `${import.meta.env.BASE_URL}sounds/notification.mp3`;

let audio: HTMLAudioElement | null = null;
let unlockBound = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = 'auto';
    audio.volume = 0.35;
  }
  return audio;
}

/** Браузеры требуют жест пользователя перед воспроизведением */
export function ensureNotificationSoundUnlocked(): void {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;

  const unlock = () => {
    const el = getAudio();
    const p = el.play();
    if (p) {
      void p
        .then(() => {
          el.pause();
          el.currentTime = 0;
        })
        .catch(() => undefined);
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

/** Звук уведомления (public/sounds/notification.mp3) */
export function playNotificationPop(): void {
  if (typeof window === 'undefined') return;
  try {
    const el = getAudio();
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  } catch {
    /* autoplay policy */
  }
}
