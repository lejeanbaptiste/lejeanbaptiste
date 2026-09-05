import type { EntityStore } from './entityStore';

/**
 * Curation warnings filed by the entity lookup dialog (lookupResolve.ts),
 * stored as JSONL at `/.grognard/entity-warnings.jsonl`. The log is append-only,
 * like the decision log: resolving a warning appends a `resolved` marker
 * rather than rewriting history, and readers filter markers out.
 *
 * lookupResolve.ts owns the write path for new warnings; this module owns the
 * shared shape, parsing (same corrupt-line tolerance as decisionLog.parseLog),
 * and the resolution path used by the entity database panel.
 */

export const WARNINGS_FILE = 'entity-warnings.jsonl';

export interface LookupWarning {
  /** ISO timestamp. */
  when: string;
  /**
   * `concordance-conflict`: an external authority record matched multiple
   * local entities (possible duplicates — suggest merging).
   * `idno-conflict`: a lookup implied an idno whose type already exists on
   * the entity with a different value (suggest verifying/splitting).
   */
  kind: 'idno-conflict' | 'concordance-conflict';
  entityIds: string[];
  /** The authority (idno type) the clicked reference belongs to. */
  authority: string;
  value: string;
  detail?: string;
}

/** Append-only marker recording that a warning was dismissed/resolved. */
export interface WarningResolution {
  when: string;
  kind: 'resolved';
  /** `warningKey` of the warning this marker closes. */
  resolves: string;
}

const WARNING_KINDS = new Set(['idno-conflict', 'concordance-conflict']);

/** Stable identity of a warning across log reads. */
export function warningKey(warning: LookupWarning): string {
  return [warning.when, warning.kind, warning.authority, warning.value].join('');
}

function isWarning(record: unknown): record is LookupWarning {
  if (typeof record !== 'object' || record === null) return false;
  const candidate = record as Partial<LookupWarning>;
  return (
    typeof candidate.when === 'string' &&
    typeof candidate.kind === 'string' &&
    WARNING_KINDS.has(candidate.kind) &&
    Array.isArray(candidate.entityIds) &&
    candidate.entityIds.every((id) => typeof id === 'string') &&
    typeof candidate.authority === 'string' &&
    typeof candidate.value === 'string'
  );
}

function isResolution(record: unknown): record is WarningResolution {
  if (typeof record !== 'object' || record === null) return false;
  const candidate = record as Partial<WarningResolution>;
  return candidate.kind === 'resolved' && typeof candidate.resolves === 'string';
}

/**
 * Parse the JSONL log into the warnings that are still open, skipping blank,
 * corrupt, and unrecognized lines. Duplicate warnings (same key) collapse to
 * one; a `resolved` marker closes every warning sharing its key.
 */
export function parseWarnings(jsonl: string): LookupWarning[] {
  const open = new Map<string, LookupWarning>();
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record: unknown;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue; // skip corrupt lines rather than failing the whole log
    }
    if (isWarning(record)) {
      open.set(warningKey(record), record);
    } else if (isResolution(record)) {
      open.delete(record.resolves);
    }
  }
  return [...open.values()];
}

/** Append a resolution marker for `warning`, returning the new log body. */
export function appendResolution(
  existing: string,
  warning: LookupWarning,
  when: string = new Date().toISOString(),
): string {
  const marker: WarningResolution = { when, kind: 'resolved', resolves: warningKey(warning) };
  const base = existing.trimEnd();
  const line = JSON.stringify(marker);
  return base ? `${base}\n${line}\n` : `${line}\n`;
}

/** Read the project's open lookup warnings (empty when the file doesn't exist). */
export async function loadOpenWarnings(store: EntityStore): Promise<LookupWarning[]> {
  const body = await store.readProjectGrognardFile(WARNINGS_FILE);
  return body ? parseWarnings(body) : [];
}

/** Persist the dismissal of `warning` by appending a resolution marker. */
export async function resolveWarning(store: EntityStore, warning: LookupWarning): Promise<void> {
  const existing = (await store.readProjectGrognardFile(WARNINGS_FILE)) ?? '';
  await store.writeProjectGrognardFile(WARNINGS_FILE, appendResolution(existing, warning));
}
