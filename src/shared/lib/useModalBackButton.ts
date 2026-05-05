// shared/lib/useModalBackButton.ts
// Closes the modal on Android/browser back button instead of navigating away.
//
// Two usage modes:
//   1. Component mounted only while open (most modals):
//      useModalBackButton(onClose)
//   2. Component always mounted, shown via prop:
//      useModalBackButton(onClose, isOpen)

import { useEffect, useRef } from 'react';

export function useModalBackButton(onClose: () => void, isOpen = true): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    history.pushState({ modal: true }, '');
    let closedByBack = false;

    const handler = () => {
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      if (!closedByBack) history.back();
    };
  }, [isOpen]);
}
