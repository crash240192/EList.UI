// shared/lib/useModalBackButton.ts
// Closes the modal on Android/browser back button instead of navigating away.
//
// Two usage modes:
//   1. Component mounted only while open (most modals):
//      useModalBackButton(onClose)
//   2. Component always mounted, shown via prop:
//      useModalBackButton(onClose, isOpen)

import { useEffect, useRef } from 'react';

const STATE_KEY = 'elistModal';

// Guards against popstate fired by our own history.back() in cleanup.
// React StrictMode runs cleanup+remount synchronously, but history.back() fires
// popstate asynchronously — the new handler would catch it and close the modal.
let ignoringOwnBack = false;
let ignoreResetTimer: ReturnType<typeof setTimeout> | null = null;

export function useModalBackButton(onClose: () => void, isOpen = true): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    history.pushState({ [STATE_KEY]: true }, '');
    let closedByBack = false;

    const handler = () => {
      if (ignoringOwnBack) {
        ignoringOwnBack = false;
        if (ignoreResetTimer !== null) {
          clearTimeout(ignoreResetTimer);
          ignoreResetTimer = null;
        }
        return;
      }
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      // Only go back if history still holds our marker.
      // If navigate() was called, React Router replaced the state — no marker —
      // so we must NOT call history.back() or it would undo the navigation.
      if (!closedByBack && history.state?.[STATE_KEY] === true) {
        ignoringOwnBack = true;
        // Reset flag if popstate never fires (edge case safety net)
        ignoreResetTimer = setTimeout(() => {
          ignoringOwnBack = false;
          ignoreResetTimer = null;
        }, 100);
        history.back();
      }
    };
  }, [isOpen]);
}
