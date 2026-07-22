/** Platform helpers for desktop UI labels (shortcuts, etc.). */

export const isMacOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;

  return userAgentData?.platform
    ? userAgentData.platform === 'macOS'
    : /Mac/i.test(navigator.userAgent);
};

/** Primary modifier key label for the current OS (⌘ on Mac, Ctrl elsewhere). */
export const modKeyLabel = (): string => (isMacOS() ? '⌘' : 'Ctrl');

/** e.g. ⌘O on Mac, Ctrl+O on Windows/Linux. */
export const modShortcut = (key: string): string =>
  isMacOS() ? `⌘${key}` : `Ctrl+${key}`;
