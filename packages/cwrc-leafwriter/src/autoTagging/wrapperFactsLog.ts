import type { WrapperDisambiguationQuery } from './wrapperDisambiguationIndex';

/**
 * Append-only log of person-wrapper combinations this project has actually
 * confirmed, stored as JSONL at `.grognard/wrapper-facts.jsonl` — the harvest
 * half of "store what we find in the text, use that for tag bombing, then
 * look up the combination to disambiguate": once a wrapper's found
 * dynasty/office/title/origin/name combination resolves to a specific
 * entity, that exact combination is remembered so the next occurrence —
 * this project or a later one reading the same database — resolves
 * instantly, without depending on Norbert already knowing the person.
 *
 * Mirrors `decisionLog.ts` exactly: pure format/parse/append functions here,
 * a thin `EntityStore.appendWrapperFacts`/`readWrapperFacts` I/O wrapper.
 */

export interface WrapperFactRecord {
  /** ISO timestamp. */
  when: string;
  query: WrapperDisambiguationQuery;
  /** Local entity id this combination resolved to. */
  entityId: string;
}

/** Serialize one record to a JSONL line (no trailing newline). */
export function formatWrapperFact(record: WrapperFactRecord): string {
  return JSON.stringify(record);
}

/** Parse a JSONL log body into records, skipping blank/corrupt lines. */
export function parseWrapperFacts(jsonl: string): WrapperFactRecord[] {
  const records: WrapperFactRecord[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as WrapperFactRecord;
      if (parsed?.query?.persName && parsed.entityId) records.push(parsed);
    } catch {
      // skip corrupt lines rather than failing the whole log
    }
  }
  return records;
}

/** Append records to an existing JSONL body, returning the new body. */
export function appendWrapperFactRecords(existing: string, records: WrapperFactRecord[]): string {
  if (records.length === 0) return existing;
  const lines = records.map(formatWrapperFact);
  const base = existing.trimEnd();
  return base ? `${base}\n${lines.join('\n')}\n` : `${lines.join('\n')}\n`;
}
