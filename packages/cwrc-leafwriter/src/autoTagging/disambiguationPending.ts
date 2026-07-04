import type { DisambiguationCandidate } from './disambiguationCandidates';

export interface PendingEntry {
  tag: string;
  surface: string;
  candidates: DisambiguationCandidate[];
  updatedAt: string;
}

export interface PendingCache {
  version: 1;
  entries: Record<string, PendingEntry>;
}

function entryKey(tag: string, surface: string): string {
  return `${tag}\0${surface}`;
}

export function parsePendingCache(json: string | null): PendingCache {
  if (!json?.trim()) return { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(json) as PendingCache;
    if (parsed.version !== 1 || !parsed.entries) return { version: 1, entries: {} };
    return parsed;
  } catch {
    return { version: 1, entries: {} };
  }
}

export function serializePendingCache(cache: PendingCache): string {
  return JSON.stringify(cache, null, 2);
}

export function getPendingCandidates(
  cache: PendingCache,
  tag: string,
  surface: string,
): DisambiguationCandidate[] | null {
  return cache.entries[entryKey(tag, surface)]?.candidates ?? null;
}

export function setPendingCandidates(
  cache: PendingCache,
  tag: string,
  surface: string,
  candidates: DisambiguationCandidate[],
): PendingCache {
  return {
    ...cache,
    entries: {
      ...cache.entries,
      [entryKey(tag, surface)]: {
        tag,
        surface,
        candidates,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}
