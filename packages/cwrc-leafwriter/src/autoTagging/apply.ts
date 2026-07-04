import { resolveAnchor } from './anchor';
import type { Suggestion, WhitespacePolicy } from './types';

export type ApplyOutcome =
  | 'applied'
  | 'unresolvable'
  | 'already-tagged'
  | 'schema-blocked'
  | 'rule-blocked'
  | 'unsupported-action';

export interface ApplyResult {
  suggestion: Suggestion;
  outcome: ApplyOutcome;
  /** The element created, when outcome is 'applied'. */
  element?: Element;
}

/** A user taste rule: block `tag` when any ancestor element is `notInside`. */
export interface UserRule {
  tag: string;
  notInside: string;
}

export interface ApplyOptions {
  policy: WhitespacePolicy;
  /**
   * Structural validity from the loaded schema, e.g.
   * (parent, child) => schemaManager.isTagValidChildOfParent(child, parent).
   * When omitted, all insertions are structurally allowed.
   */
  canContain?: (parentTag: string, childTag: string) => boolean;
  /** Schema-allowed but unwanted combinations. Blocks during auto-tagging. */
  userRules?: UserRule[];
  /** Called after each suggestion is processed (done, total). */
  onProgress?: (done: number, total: number) => void;
}

export interface BatchResult {
  results: ApplyResult[];
  applied: number;
  /** Serialized document as it was before any change, for snapshot revert. */
  snapshot: string;
}

const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/**
 * Apply a batch of 'add' suggestions to a document.
 *
 * Suggestions are sorted longest-surface-first (conflict rule 1: prefer the
 * longer span) and each anchor is resolved immediately before its own
 * insertion, so earlier insertions cannot invalidate later offsets. Nothing
 * is ever applied approximately: a suggestion whose anchor fails to resolve
 * is marked unresolvable and skipped.
 */
export async function applySuggestions(
  doc: Document,
  suggestions: Suggestion[],
  options: ApplyOptions,
): Promise<BatchResult> {
  const snapshot = new XMLSerializer().serializeToString(doc);
  const ordered = [...suggestions].sort(
    (a, b) => b.anchor.surface.length - a.anchor.surface.length,
  );

  const results: ApplyResult[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const suggestion = ordered[index]!;
    const result = applyOne(doc, suggestion, options);
    suggestion.status =
      result.outcome === 'applied'
        ? 'accepted'
        : result.outcome === 'unresolvable'
          ? 'unresolvable'
          : suggestion.status;
    results.push(result);
    options.onProgress?.(index + 1, ordered.length);
    if (options.onProgress && (index + 1) % 8 === 0) {
      await yieldToUi();
    }
  }

  return {
    results,
    applied: results.filter((r) => r.outcome === 'applied').length,
    snapshot,
  };
}

function applyOne(doc: Document, suggestion: Suggestion, options: ApplyOptions): ApplyResult {
  if (suggestion.action !== 'add') return { suggestion, outcome: 'unsupported-action' };

  const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!resolved) return { suggestion, outcome: 'unresolvable' };

  const parent = resolved.node.parentElement;
  if (!parent) return { suggestion, outcome: 'unresolvable' };

  // Dedup: skip if the same tag already wraps this text (any ancestor of the
  // text node with the same name — inserting would nest <persName> in <persName>).
  for (let el: Element | null = parent; el; el = el.parentElement) {
    if (el.nodeName === suggestion.tag) return { suggestion, outcome: 'already-tagged' };
  }

  // Structural validity against the immediate parent, from the schema.
  if (options.canContain && !options.canContain(parent.nodeName, suggestion.tag)) {
    return { suggestion, outcome: 'schema-blocked' };
  }

  // User taste rules: block when any ancestor matches notInside.
  for (const rule of options.userRules ?? []) {
    if (rule.tag !== suggestion.tag) continue;
    for (let el: Element | null = parent; el; el = el.parentElement) {
      if (el.nodeName === rule.notInside) return { suggestion, outcome: 'rule-blocked' };
    }
  }

  const element = wrapRange(doc, resolved.node, resolved.start, resolved.end, suggestion);
  return { suggestion, outcome: 'applied', element };
}

/** Wrap [start, end) of a text node in a new element, splitting the node. */
function wrapRange(
  doc: Document,
  node: Text,
  start: number,
  end: number,
  suggestion: Suggestion,
): Element {
  const target = start > 0 ? node.splitText(start) : node;
  if (end - start < target.data.length) target.splitText(end - start);

  const element = doc.createElementNS(doc.documentElement?.namespaceURI ?? null, suggestion.tag);
  for (const [name, value] of Object.entries(suggestion.attributes ?? {})) {
    element.setAttribute(name, value);
  }

  target.parentNode!.insertBefore(element, target);
  element.appendChild(target);
  return element;
}

/** Reparse a snapshot taken by applySuggestions, undoing the whole batch. */
export function revertToSnapshot(snapshot: string): Document {
  return new DOMParser().parseFromString(snapshot, 'application/xml');
}

export type EntityApplyAction = 'assign-entity' | 'mark-unresolved';

export interface AssignEntityInput {
  element: Element;
  entityId: string;
  resp?: string;
}

export interface AssignEntityResult {
  action: 'assign-entity';
  entityId: string;
  element: Element;
}

export interface MarkUnresolvedResult {
  action: 'mark-unresolved';
  element: Element;
}

/** Assign a local entity id to an already-tagged mention element. */
export function assignEntity(input: AssignEntityInput): AssignEntityResult {
  const { element, entityId, resp } = input;
  element.setAttribute('key', entityId);
  element.removeAttribute('cert');
  if (resp) element.setAttribute('resp', resp);
  return { action: 'assign-entity', entityId, element };
}

/** Mark a mention unresolved without removing the tag. */
export function markUnresolved(element: Element): MarkUnresolvedResult {
  element.removeAttribute('key');
  element.setAttribute('cert', 'unknown');
  return { action: 'mark-unresolved', element };
}
