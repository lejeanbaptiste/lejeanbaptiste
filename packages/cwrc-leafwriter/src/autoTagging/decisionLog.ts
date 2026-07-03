import type { Decision, DecisionEvent } from './reviewController';
import type { Suggestion } from './types';

/**
 * Append-only decision log (Phase 3), stored as JSONL at
 * `/.leaf/entity-decisions.jsonl`. Every accept/reject/resolve is one line;
 * counts and "user's past decisions" (feeding AI ranking later) are derived
 * from the log, not stored separately.
 */

export type DecisionAction =
  | 'accepted'
  | 'rejected'
  | 'resolved'
  | 'auto-resolved'
  | 'unresolved';

export type DecisionScope = 'occurrence' | 'document-surface' | 'selection';

export interface DecisionRecord {
  /** ISO timestamp. */
  when: string;
  /** Document the mention lives in. */
  documentId: string;
  surface: string;
  tag: string;
  action: DecisionAction;
  /** Producer that proposed it: dictionary, dates, ai, ner, disambiguation. */
  source: string;
  /** Local entity id assigned, when the action resolves identity. */
  entityId?: string;
  /** Candidate id rejected/passed over, when relevant. */
  rejectedCandidate?: string;
  scope: DecisionScope;
  /** Occurrence index + node hash, to re-locate the mention if needed. */
  occurrence?: number;
  nodeHash?: string;
}

/** Serialize one record to a JSONL line (no trailing newline). */
export function formatRecord(record: DecisionRecord): string {
  return JSON.stringify(record);
}

/** Parse a JSONL log body into records, skipping blank/corrupt lines. */
export function parseLog(jsonl: string): DecisionRecord[] {
  const records: DecisionRecord[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as DecisionRecord);
    } catch {
      // skip corrupt lines rather than failing the whole log
    }
  }
  return records;
}

/** Append records to an existing JSONL body, returning the new body. */
export function appendRecords(existing: string, records: DecisionRecord[]): string {
  if (records.length === 0) return existing;
  const lines = records.map(formatRecord);
  const base = existing.trimEnd();
  return base ? `${base}\n${lines.join('\n')}\n` : `${lines.join('\n')}\n`;
}

const DECISION_ACTION: Record<Decision, DecisionAction> = {
  accepted: 'accepted',
  rejected: 'rejected',
};

/**
 * Turn a review-walk DecisionEvent into a log record. This is what a host
 * wires to ReviewController's `onDecision`, buffering records and appending
 * them to `/.leaf/entity-decisions.jsonl`.
 */
export function recordFromDecision(
  event: DecisionEvent,
  when: string = new Date().toISOString(),
): DecisionRecord {
  const { suggestion, decision } = event;
  return {
    when,
    documentId: suggestion.anchor.documentId,
    surface: suggestion.anchor.surface,
    tag: suggestion.tag,
    action: DECISION_ACTION[decision],
    source: suggestion.source,
    scope: 'occurrence',
    occurrence: suggestion.anchor.occurrence,
    nodeHash: suggestion.anchor.nodeHash,
  };
}

/** Counts derived from the log — the "N pending/accepted/rejected" figures. */
export function deriveCounts(records: DecisionRecord[]) {
  const counts: Record<DecisionAction, number> = {
    accepted: 0,
    rejected: 0,
    resolved: 0,
    'auto-resolved': 0,
    unresolved: 0,
  };
  for (const record of records) counts[record.action] += 1;
  return counts;
}

/**
 * Collect a buffer of decision records over a session. A host creates one,
 * subscribes `push`-via-`onDecision`, then flushes to disk.
 */
export class DecisionLogBuffer {
  private readonly records: DecisionRecord[] = [];

  add(event: DecisionEvent): void {
    this.records.push(recordFromDecision(event));
  }

  /** Add a resolution/auto-resolution/unresolved record directly. */
  addRecord(record: DecisionRecord): void {
    this.records.push(record);
  }

  get pending(): DecisionRecord[] {
    return [...this.records];
  }

  get length(): number {
    return this.records.length;
  }

  /** Merge the buffered records into an existing log body and clear the buffer. */
  flush(existing = ''): string {
    const body = appendRecords(existing, this.records);
    this.records.length = 0;
    return body;
  }
}

// Referenced for typing convenience by callers that construct records from suggestions.
export type { Suggestion };
