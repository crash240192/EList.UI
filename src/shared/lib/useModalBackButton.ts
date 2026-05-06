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

export function useModalBackButton(onClose: () => void, isOpen = true): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    history.pushState({ [STATE_KEY]: true }, '');
    let closedByBack = false;

    const handler = () => {
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
        history.back();
      }
    };
  }, [isOpen]);
}
