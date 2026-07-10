/**
 * Tiny global store tracking background authority-asset activity, so the UI
 * can show an unobtrusive indicator while packs stream in from disk or the
 * disambiguation prefetcher works through mention groups. Deliberately not
 * Overmind/jotai: it's written to from non-React plumbing (pack reads, idle
 * prefetch ticks) and read via useSyncExternalStore.
 */

export interface AuthorityLoadProgress {
  /** Uncached pack files currently being read from disk. */
  activePackReads: number;
  /** Mention groups already prefetched in the current background sweep. */
  prefetchDone: number;
  /** Total mention groups queued in the current background sweep (0 = idle). */
  prefetchTotal: number;
}

let state: AuthorityLoadProgress = { activePackReads: 0, prefetchDone: 0, prefetchTotal: 0 };
const listeners = new Set<() => void>();

const emit = (next: Partial<AuthorityLoadProgress>) => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};

export const getAuthorityLoadProgress = (): AuthorityLoadProgress => state;

export const subscribeAuthorityLoadProgress = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const packReadStarted = (): void => emit({ activePackReads: state.activePackReads + 1 });

export const packReadFinished = (): void =>
  emit({ activePackReads: Math.max(0, state.activePackReads - 1) });

export const prefetchProgress = (done: number, total: number): void =>
  emit({ prefetchDone: done, prefetchTotal: total });

export const prefetchFinished = (): void => emit({ prefetchDone: 0, prefetchTotal: 0 });
