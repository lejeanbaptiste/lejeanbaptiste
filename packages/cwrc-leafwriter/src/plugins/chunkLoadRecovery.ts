const CHUNK_RELOAD_KEY = 'leafwriter:chunk-reload';

export const isChunkLoadFailure = (value: unknown): boolean => {
  const message = value instanceof Error ? value.message : String(value);
  return message.includes('ChunkLoadError') || message.includes('Loading chunk');
};

/**
 * A dev-server rebuild can replace a lazy chunk after the page has loaded its
 * old manifest. Reload once to obtain the new manifest; the session guard
 * prevents a genuinely broken chunk from causing a reload loop.
 */
export const recoverFromChunkLoadFailure = (value: unknown): boolean => {
  if (typeof window === 'undefined' || !isChunkLoadFailure(value)) return false;

  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return false;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.setTimeout(() => window.location.reload(), 100);
  return true;
};

export const clearChunkLoadRecoveryGuard = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
};
