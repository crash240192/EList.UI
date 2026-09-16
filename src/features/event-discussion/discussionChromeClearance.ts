/** CSS var: bottom clearance for page chrome that must sit above discussion FAB/composer. */
export const DISCUSSION_CHROME_CLEARANCE_VAR = '--discussion-chrome-clearance';

export function setDiscussionChromeClearance(px: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(
    DISCUSSION_CHROME_CLEARANCE_VAR,
    `${Math.max(0, Math.round(px))}px`,
  );
}

export function clearDiscussionChromeClearance(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.removeProperty(DISCUSSION_CHROME_CLEARANCE_VAR);
}
