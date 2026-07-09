import type { AuthorityCache } from './authorityCache';
import { buildDisambiguationCandidates, type DisambiguationCandidate } from './disambiguationCandidates';
import {
  disambiguationCachingDisabledFromSettings,
  readPersistedDisambiguationSettings,
} from './disambiguationSettings';
import type { DilaPlaceDetailCache } from './dilaPlaceDetailCache';
import type { MentionGroup } from './mentions';

const SAVE_DEBOUNCE_MS = 3000;
const IDLE_FALLBACK_MS = 200;

/**
 * The slice of AutoTaggingSession this scheduler needs. Kept structural (like
 * WriterLike in integration.ts) so it's testable without a live session.
 */
export interface AuthorityPrefetchSession {
  readonly cache: AuthorityCache | null;
  readonly dilaPlaceDetailCache: DilaPlaceDetailCache | null;
  getPendingCandidates(tag: string, surface: string): DisambiguationCandidate[] | null;
  rememberPendingCandidates(tag: string, surface: string, candidates: DisambiguationCandidate[]): void;
  getEntitiesDocument(): Document | null;
  loadEntities(): Promise<Document>;
  savePendingCache(): Promise<void>;
}

export interface AuthorityPrefetchHandle {
  stop(): void;
}

const NOOP_HANDLE: AuthorityPrefetchHandle = { stop: () => {} };

function scheduleIdle(callback: () => void): () => void {
  const scope = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof scope.requestIdleCallback === 'function') {
    const handle = scope.requestIdleCallback(callback, { timeout: 1000 });
    return () => scope.cancelIdleCallback?.(handle);
  }
  const timer = setTimeout(callback, IDLE_FALLBACK_MS);
  return () => clearTimeout(timer);
}

/**
 * Warms the disambiguation pending-cache for not-yet-resolved mention groups while
 * the user is doing something else, one group per idle tick, sharing the session's
 * existing AuthorityCache throttle with any foreground lookup. Never triggers AI
 * ranking or a DILA detail refetch loop — those stay on-demand, opened-panel-only steps.
 */
export function runAuthorityPrefetch(
  session: AuthorityPrefetchSession,
  groups: MentionGroup[],
): AuthorityPrefetchHandle {
  if (disambiguationCachingDisabledFromSettings(readPersistedDisambiguationSettings())) {
    return NOOP_HANDLE;
  }

  const cache = session.cache;
  if (!cache) return NOOP_HANDLE;

  const queue = groups.filter(
    (group) => !group.fullyResolved && session.getPendingCandidates(group.tag, group.surface) == null,
  );
  if (queue.length === 0) return NOOP_HANDLE;

  let stopped = false;
  let cancelIdle: (() => void) | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const flushSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (dirty) {
      dirty = false;
      void session.savePendingCache();
    }
  };

  const scheduleSave = () => {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (!dirty) return;
      dirty = false;
      void session.savePendingCache();
    }, SAVE_DEBOUNCE_MS);
  };

  let index = 0;
  const tick = async () => {
    if (stopped) return;
    if (index >= queue.length) {
      flushSave();
      return;
    }
    const group = queue[index++]!;
    try {
      // A foreground lookup may have already resolved this group since it was queued.
      if (session.getPendingCandidates(group.tag, group.surface) == null) {
        const entitiesDoc = session.getEntitiesDocument() ?? (await session.loadEntities());
        if (stopped) return;
        const rows = await buildDisambiguationCandidates(
          entitiesDoc,
          group.tag,
          group.surface,
          cache,
          ['Wikidata', 'VIAF'],
          false,
          window.electronAPI?.authorityPackRead,
          session.dilaPlaceDetailCache ?? undefined,
        );
        if (stopped) return;
        session.rememberPendingCandidates(group.tag, group.surface, rows);
        scheduleSave();
      }
    } catch {
      // Best-effort — a failed background prefetch just leaves the group to load on-demand.
    }
    if (!stopped) cancelIdle = scheduleIdle(() => void tick());
  };

  cancelIdle = scheduleIdle(() => void tick());

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelIdle?.();
      flushSave();
    },
  };
}
