import { resolveAnchor } from './anchor';
import type { Suggestion, SuggestionAction, WhitespacePolicy } from './types';

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

/** Audit corrections before new insertions; within each tier, prefer longer spans. */
const ACTION_PRIORITY: Partial<Record<SuggestionAction, number>> = {
  'redraw-boundary': 0,
  retag: 1,
  remove: 2,
  add: 3,
};

function compareSuggestions(a: Suggestion, b: Suggestion): number {
  const pa = ACTION_PRIORITY[a.action] ?? 99;
  const pb = ACTION_PRIORITY[b.action] ?? 99;
  if (pa !== pb) return pa - pb;
  return b.anchor.surface.length - a.anchor.surface.length;
}

/**
 * Apply a batch of suggestions to a document (`add` plus audit actions).
 *
 * Suggestions are sorted audit-first, then longest-surface-first (conflict
 * rule 1: prefer the longer span). Each anchor is resolved immediately
 * before its own mutation. Nothing is ever applied approximately: a
 * suggestion whose anchor fails to resolve is marked unresolvable and skipped.
 */
export async function applySuggestions(
  doc: Document,
  suggestions: Suggestion[],
  options: ApplyOptions,
): Promise<BatchResult> {
  const snapshot = new XMLSerializer().serializeToString(doc);
  const ordered = [...suggestions].sort(compareSuggestions);

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
  switch (suggestion.action) {
    case 'add':
      return applyAdd(doc, suggestion, options);
    case 'remove':
      return applyRemove(doc, suggestion, options);
    case 'retag':
      return applyRetag(doc, suggestion, options);
    case 'redraw-boundary':
      return applyRedrawBoundary(doc, suggestion, options);
    default:
      return { suggestion, outcome: 'unsupported-action' };
  }
}

function applyAdd(doc: Document, suggestion: Suggestion, options: ApplyOptions): ApplyResult {
  const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!resolved) return { suggestion, outcome: 'unresolvable' };

  const parent = resolved.node.parentElement;
  if (!parent) return { suggestion, outcome: 'unresolvable' };

  // Dedup: skip if the same tag already wraps this text (any ancestor of the
  // text node with the same name — inserting would nest <persName> in <persName>).
  for (let el: Element | null = parent; el; el = el.parentElement) {
    if (el.nodeName === suggestion.tag) return { suggestion, outcome: 'already-tagged' };
  }

  if (blockedBySchema(parent.nodeName, suggestion.tag, options)) {
    return { suggestion, outcome: 'schema-blocked' };
  }
  if (blockedByUserRule(parent, suggestion.tag, options)) {
    return { suggestion, outcome: 'rule-blocked' };
  }

  const element = wrapRange(doc, resolved.node, resolved.start, resolved.end, suggestion);
  return { suggestion, outcome: 'applied', element };
}

function applyRemove(doc: Document, suggestion: Suggestion, options: ApplyOptions): ApplyResult {
  const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!resolved) return { suggestion, outcome: 'unresolvable' };

  const wrapper = findTagWrapper(resolved.node, suggestion.tag);
  if (!wrapper) return { suggestion, outcome: 'unresolvable' };

  unwrapElement(wrapper);
  return { suggestion, outcome: 'applied', element: wrapper };
}

function applyRetag(doc: Document, suggestion: Suggestion, options: ApplyOptions): ApplyResult {
  const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!resolved) return { suggestion, outcome: 'unresolvable' };

  const wrapper = findWrongTagWrapper(resolved.node, suggestion.tag);
  if (!wrapper) return { suggestion, outcome: 'unresolvable' };
  if (wrapper.nodeName === suggestion.tag) return { suggestion, outcome: 'already-tagged' };

  const parent = wrapper.parentElement;
  if (!parent) return { suggestion, outcome: 'unresolvable' };
  if (blockedBySchema(parent.nodeName, suggestion.tag, options)) {
    return { suggestion, outcome: 'schema-blocked' };
  }
  if (blockedByUserRule(parent, suggestion.tag, options)) {
    return { suggestion, outcome: 'rule-blocked' };
  }

  const element = retagElement(doc, wrapper, suggestion.tag);
  return { suggestion, outcome: 'applied', element };
}

function applyRedrawBoundary(
  doc: Document,
  suggestion: Suggestion,
  options: ApplyOptions,
): ApplyResult {
  const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!resolved) return { suggestion, outcome: 'unresolvable' };

  const wrapper = findTagWrapper(resolved.node, suggestion.tag);
  if (!wrapper) return { suggestion, outcome: 'unresolvable' };

  const parent = wrapper.parentElement;
  if (!parent) return { suggestion, outcome: 'unresolvable' };

  unwrapElement(wrapper);

  const reResolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!reResolved) return { suggestion, outcome: 'unresolvable' };

  const insertParent = reResolved.node.parentElement;
  if (!insertParent) return { suggestion, outcome: 'unresolvable' };
  if (blockedBySchema(insertParent.nodeName, suggestion.tag, options)) {
    return { suggestion, outcome: 'schema-blocked' };
  }
  if (blockedByUserRule(insertParent, suggestion.tag, options)) {
    return { suggestion, outcome: 'rule-blocked' };
  }

  const element = wrapRange(doc, reResolved.node, reResolved.start, reResolved.end, suggestion);
  return { suggestion, outcome: 'applied', element };
}

function blockedBySchema(parentTag: string, childTag: string, options: ApplyOptions): boolean {
  return !!(options.canContain && !options.canContain(parentTag, childTag));
}

function blockedByUserRule(parent: Element, tag: string, options: ApplyOptions): boolean {
  for (const rule of options.userRules ?? []) {
    if (rule.tag !== tag) continue;
    for (let el: Element | null = parent; el; el = el.parentElement) {
      if (el.nodeName === rule.notInside) return true;
    }
  }
  return false;
}

/** Innermost ancestor element with the given tag name wrapping `node`. */
function findTagWrapper(node: Text, tag: string): Element | null {
  for (let el: Element | null = node.parentElement; el; el = el.parentElement) {
    if (el.nodeName === tag) return el;
  }
  return null;
}

/** Tags that may wrap a named entity mention (same set crawl uses by default). */
const ENTITY_TAGS = new Set([
  'persName',
  'placeName',
  'orgName',
  'geogName',
  'name',
  'roleName',
  'title',
  'date',
]);

/** Innermost ancestor entity tag that is not the target tag (for retag). */
function findWrongTagWrapper(node: Text, targetTag: string): Element | null {
  for (let el: Element | null = node.parentElement; el; el = el.parentElement) {
    if (el.nodeName === targetTag) return null;
    if (ENTITY_TAGS.has(el.nodeName)) return el;
  }
  return null;
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function retagElement(doc: Document, element: Element, newTag: string): Element {
  const ns = doc.documentElement?.namespaceURI ?? null;
  const replacement = doc.createElementNS(ns, newTag);
  for (const attr of Array.from(element.attributes)) {
    replacement.setAttribute(attr.name, attr.value);
  }
  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }
  element.parentNode!.replaceChild(replacement, element);
  return replacement;
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
