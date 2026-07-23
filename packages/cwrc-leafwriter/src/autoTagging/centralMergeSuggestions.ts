/**
 * The **merge docket**: when a PEDB merge unions two project entities that
 * each carry a `ljb-central` mapping for the same user pointing at two
 * *different* central ids (see the `centralConflicts` produced by
 * `mergeEntities`), that's a strong hint the two central entities are the
 * same too — but merging central entities affects every project bridged to
 * that catalogue, so it must never happen silently. Instead it becomes a
 * **suggestion**, appended to a durable log beside the central `entities.xml`
 * (mirroring `entityOrders.ts`), for the user to review and accept or ignore.
 *
 * Two append-only JSONL logs, like the order log:
 *  - suggestions: the raw proposals ("these two central ids might be dupes").
 *  - resolutions: what the user decided about each suggestion id, so a
 *    dismissed suggestion never resurfaces, and an accepted one isn't
 *    reapplied.
 *
 * `pendingMergeSuggestions` folds both logs plus the central database's own
 * order log (so a suggestion already satisfied by an ordinary Absorb quietly
 * drops off the docket) into the list still worth showing the user.
 */

import { findEntity } from './entities';
import type { EntityFileApi } from './entityStore';
import { composeRemap, type EntityOrder } from './entityOrders';

export const MERGE_SUGGESTIONS_FILE = 'entity-merge-suggestions.jsonl';
export const MERGE_SUGGESTION_RESOLUTIONS_FILE = 'entity-merge-suggestion-resolutions.jsonl';

export interface CentralMergeSuggestion {
  /** Unique id for this suggestion (dedup key; also what a resolution references). */
  id: string;
  /** ISO timestamp the suggestion was raised. */
  when: string;
  /** Fingerprint of the PEDB whose merge surfaced this. Informational only. */
  sourceDbId: string;
  /** The two central ids that might be duplicates (order carries no meaning). */
  centralIds: [string, string];
}

export type MergeSuggestionAction = 'merged' | 'ignored';

export interface MergeSuggestionResolution {
  /** Unique id for this resolution record. */
  id: string;
  /** The suggestion this resolves. */
  suggestionId: string;
  /** ISO timestamp of the decision. */
  when: string;
  action: MergeSuggestionAction;
}

const randomId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
};

export function makeMergeSuggestion(
  sourceDbId: string,
  centralIds: [string, string],
  when: string = new Date().toISOString(),
): CentralMergeSuggestion {
  return { id: randomId('suggestion'), when, sourceDbId, centralIds };
}

export function makeMergeSuggestionResolution(
  suggestionId: string,
  action: MergeSuggestionAction,
  when: string = new Date().toISOString(),
): MergeSuggestionResolution {
  return { id: randomId('resolution'), suggestionId, when, action };
}

/* -------------------------------------------------------------------------- */
/* JSONL plumbing — same shape as entityOrders.ts                             */
/* -------------------------------------------------------------------------- */

function suggestionsPathFor(entitiesPath: string): string {
  return entitiesPath.replace(/[^/\\]+$/, MERGE_SUGGESTIONS_FILE);
}

function resolutionsPathFor(entitiesPath: string): string {
  return entitiesPath.replace(/[^/\\]+$/, MERGE_SUGGESTION_RESOLUTIONS_FILE);
}

function appendJsonl<T>(existing: string, records: T[]): string {
  if (records.length === 0) return existing;
  const lines = records.map((record) => JSON.stringify(record));
  const base = existing.trimEnd();
  return base ? `${base}\n${lines.join('\n')}\n` : `${lines.join('\n')}\n`;
}

function parseSuggestions(jsonl: string): CentralMergeSuggestion[] {
  const out: CentralMergeSuggestion[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as CentralMergeSuggestion;
      if (
        parsed?.id &&
        parsed.sourceDbId &&
        Array.isArray(parsed.centralIds) &&
        parsed.centralIds.length === 2
      ) {
        out.push(parsed);
      }
    } catch {
      // skip corrupt lines rather than failing the whole log
    }
  }
  return out;
}

function parseResolutions(jsonl: string): MergeSuggestionResolution[] {
  const out: MergeSuggestionResolution[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as MergeSuggestionResolution;
      if (
        parsed?.id &&
        parsed.suggestionId &&
        (parsed.action === 'merged' || parsed.action === 'ignored')
      ) {
        out.push(parsed);
      }
    } catch {
      // skip corrupt lines rather than failing the whole log
    }
  }
  return out;
}

export async function readMergeSuggestions(
  api: EntityFileApi,
  entitiesPath: string,
): Promise<CentralMergeSuggestion[]> {
  const path = suggestionsPathFor(entitiesPath);
  if (!(await api.pathExists(path))) return [];
  try {
    return parseSuggestions(await api.readFile(path));
  } catch {
    return [];
  }
}

export async function recordMergeSuggestion(
  api: EntityFileApi,
  entitiesPath: string,
  suggestion: CentralMergeSuggestion,
): Promise<void> {
  const path = suggestionsPathFor(entitiesPath);
  const existing = (await api.pathExists(path)) ? await api.readFile(path) : '';
  await api.armOwnWrite?.(path);
  await api.writeFile(path, appendJsonl(existing, [suggestion]));
  await api.notifyOwnWrite?.(path);
}

export async function readMergeSuggestionResolutions(
  api: EntityFileApi,
  entitiesPath: string,
): Promise<MergeSuggestionResolution[]> {
  const path = resolutionsPathFor(entitiesPath);
  if (!(await api.pathExists(path))) return [];
  try {
    return parseResolutions(await api.readFile(path));
  } catch {
    return [];
  }
}

export async function recordMergeSuggestionResolution(
  api: EntityFileApi,
  entitiesPath: string,
  resolution: MergeSuggestionResolution,
): Promise<void> {
  const path = resolutionsPathFor(entitiesPath);
  const existing = (await api.pathExists(path)) ? await api.readFile(path) : '';
  await api.armOwnWrite?.(path);
  await api.writeFile(path, appendJsonl(existing, [resolution]));
  await api.notifyOwnWrite?.(path);
}

/* -------------------------------------------------------------------------- */
/* Docket: which suggestions are still worth showing                         */
/* -------------------------------------------------------------------------- */

export interface PendingMergeSuggestion {
  id: string;
  when: string;
  /** The two central ids as they currently stand (already resolved through any real merge order chain). */
  centralIds: [string, string];
}

/**
 * Fold the suggestion log, the resolution log, and the central database's own
 * order log into the suggestions still worth asking the user about:
 *  - already resolved (merged or ignored) → dropped.
 *  - either id already merged away with no requested-pair survivor left, or
 *    the pair already converged to the same id via an ordinary Absorb →
 *    dropped (nothing left to decide).
 *  - either id no longer exists in the central database at all → dropped
 *    (stale; the entity was deleted outright).
 *  - two suggestions that resolve to the same unordered pair → collapsed to one.
 */
export function pendingMergeSuggestions(
  suggestions: CentralMergeSuggestion[],
  resolutions: MergeSuggestionResolution[],
  cedbOrders: EntityOrder[],
  cedbDbId: string,
  cedbDoc: Document,
): PendingMergeSuggestion[] {
  const resolvedIds = new Set(resolutions.map((resolution) => resolution.suggestionId));
  const remap = composeRemap(cedbOrders.filter((order) => order.dbId === cedbDbId));
  const resolve = (id: string): string | null => (id in remap ? remap[id]! : id);

  const seenPairs = new Set<string>();
  const out: PendingMergeSuggestion[] = [];
  for (const suggestion of suggestions) {
    if (resolvedIds.has(suggestion.id)) continue;

    const [rawA, rawB] = suggestion.centralIds;
    const a = resolve(rawA);
    const b = resolve(rawB);
    if (!a || !b) continue; // one side was deleted outright — nothing to merge
    if (a === b) continue; // already unified by a regular Absorb
    if (!findEntity(cedbDoc, a) || !findEntity(cedbDoc, b)) continue; // stale

    const pairKey = [a, b].sort().join(' ');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    out.push({ id: suggestion.id, when: suggestion.when, centralIds: [a, b] });
  }
  return out;
}
