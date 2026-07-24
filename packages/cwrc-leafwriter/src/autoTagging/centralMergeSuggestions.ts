/**
 * The **merge docket**: two kinds of "this project touched something linked
 * to the central database — review the central side too" proposals, appended
 * to a durable log beside the central `entities.xml` (mirroring
 * `entityOrders.ts`), for the user to review and accept or ignore. Merging
 * or purging central entities affects every project bridged to that
 * catalogue, so it must never happen silently.
 *
 *  - **merge**: a PEDB merge unioned two project entities that each carry a
 *    `ljb-central` mapping for the same user pointing at two *different*
 *    central ids (see the `centralConflicts` produced by `mergeEntities`) —
 *    a strong hint the two central entities are duplicates too.
 *  - **delete**: a PEDB entity carrying a `ljb-central` mapping was deleted
 *    (purged) from the project — a hint the linked central entity may now be
 *    an orphan worth reviewing for deletion too. (Not raised for the
 *    corpus-only "purge keys" recovery flow, which never touches
 *    `entities.xml` or the concordance.)
 *
 * Two append-only JSONL logs, like the order log:
 *  - suggestions: the raw proposals.
 *  - resolutions: what the user decided about each suggestion id, so a
 *    dismissed suggestion never resurfaces, and an accepted one isn't
 *    reapplied.
 *
 * `pendingMergeSuggestions` / `pendingDeleteSuggestions` fold both logs plus
 * the central database's own order log (so a suggestion already satisfied by
 * an ordinary Absorb/delete quietly drops off the docket) into the entries
 * still worth showing the user.
 */

import { findEntity } from './entities';
import type { EntityFileApi } from './entityStore';
import { composeRemap, type EntityOrder } from './entityOrders';

export const MERGE_SUGGESTIONS_FILE = 'entity-merge-suggestions.jsonl';
export const MERGE_SUGGESTION_RESOLUTIONS_FILE = 'entity-merge-suggestion-resolutions.jsonl';

export interface CentralMergeSuggestion {
  kind: 'merge';
  /** Unique id for this suggestion (dedup key; also what a resolution references). */
  id: string;
  /** ISO timestamp the suggestion was raised. */
  when: string;
  /** Fingerprint of the PEDB whose merge surfaced this. Informational only. */
  sourceDbId: string;
  /** The two central ids that might be duplicates (order carries no meaning). */
  centralIds: [string, string];
}

export interface CentralDeleteSuggestion {
  kind: 'delete';
  /** Unique id for this suggestion (dedup key; also what a resolution references). */
  id: string;
  /** ISO timestamp the suggestion was raised. */
  when: string;
  /** Fingerprint of the PEDB whose delete surfaced this. Informational only. */
  sourceDbId: string;
  /** The central id whose PEDB counterpart was deleted. */
  centralId: string;
}

export type CentralSuggestion = CentralMergeSuggestion | CentralDeleteSuggestion;

export type MergeSuggestionAction = 'merged' | 'deleted' | 'ignored';

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
  return { kind: 'merge', id: randomId('suggestion'), when, sourceDbId, centralIds };
}

export function makeDeleteSuggestion(
  sourceDbId: string,
  centralId: string,
  when: string = new Date().toISOString(),
): CentralDeleteSuggestion {
  return { kind: 'delete', id: randomId('suggestion'), when, sourceDbId, centralId };
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

function parseSuggestions(jsonl: string): CentralSuggestion[] {
  const out: CentralSuggestion[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as CentralSuggestion;
      if (!parsed?.id || !parsed.sourceDbId) continue;
      if (parsed.kind === 'delete' && typeof parsed.centralId === 'string' && parsed.centralId) {
        out.push(parsed);
      } else if (
        (parsed.kind === 'merge' || parsed.kind === undefined) &&
        Array.isArray((parsed as CentralMergeSuggestion).centralIds) &&
        (parsed as CentralMergeSuggestion).centralIds.length === 2
      ) {
        // `kind` defaults to 'merge' for lines written before the delete kind existed.
        out.push({ ...(parsed as CentralMergeSuggestion), kind: 'merge' });
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
        (parsed.action === 'merged' || parsed.action === 'deleted' || parsed.action === 'ignored')
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
): Promise<CentralSuggestion[]> {
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
  suggestion: CentralSuggestion,
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
 * order log into the merge suggestions still worth asking the user about:
 *  - already resolved (merged or ignored) → dropped.
 *  - either id already merged away with no requested-pair survivor left, or
 *    the pair already converged to the same id via an ordinary Absorb →
 *    dropped (nothing left to decide).
 *  - either id no longer exists in the central database at all → dropped
 *    (stale; the entity was deleted outright).
 *  - two suggestions that resolve to the same unordered pair → collapsed to one.
 */
export function pendingMergeSuggestions(
  suggestions: CentralSuggestion[],
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
    if (suggestion.kind !== 'merge') continue;
    if (resolvedIds.has(suggestion.id)) continue;

    const [rawA, rawB] = suggestion.centralIds;
    const a = resolve(rawA);
    const b = resolve(rawB);
    if (!a || !b) continue; // one side was deleted outright — nothing to merge
    if (a === b) continue; // already unified by a regular Absorb
    if (!findEntity(cedbDoc, a) || !findEntity(cedbDoc, b)) continue; // stale

    const pairKey = [a, b].sort().join(' ');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    out.push({ id: suggestion.id, when: suggestion.when, centralIds: [a, b] });
  }
  return out;
}

export interface PendingDeleteSuggestion {
  id: string;
  when: string;
  /** The central id as it currently stands (resolved through any real order chain). */
  centralId: string;
}

/**
 * Fold the suggestion log, the resolution log, and the central database's own
 * order log into the delete suggestions still worth asking the user about —
 * same rules as `pendingMergeSuggestions`: already resolved, already
 * deleted/merged away upstream, or duplicate central id → dropped.
 */
export function pendingDeleteSuggestions(
  suggestions: CentralSuggestion[],
  resolutions: MergeSuggestionResolution[],
  cedbOrders: EntityOrder[],
  cedbDbId: string,
  cedbDoc: Document,
): PendingDeleteSuggestion[] {
  const resolvedIds = new Set(resolutions.map((resolution) => resolution.suggestionId));
  const remap = composeRemap(cedbOrders.filter((order) => order.dbId === cedbDbId));
  const resolve = (id: string): string | null => (id in remap ? remap[id]! : id);

  const seen = new Set<string>();
  const out: PendingDeleteSuggestion[] = [];
  for (const suggestion of suggestions) {
    if (suggestion.kind !== 'delete') continue;
    if (resolvedIds.has(suggestion.id)) continue;

    const resolved = resolve(suggestion.centralId);
    if (!resolved) continue; // already deleted/merged away upstream — nothing to purge
    if (!findEntity(cedbDoc, resolved)) continue; // stale
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push({ id: suggestion.id, when: suggestion.when, centralId: resolved });
  }
  return out;
}
