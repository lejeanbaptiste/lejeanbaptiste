import { resolveAnchor } from './anchor';
import { isEntityTagForbiddenInDate, isInsideDateElement } from './dates';
import { isWrappedByEntityTag } from './suggestionFilters';
import type { Suggestion, SuggestionAction, WhitespacePolicy } from './types';

export type ApplyOutcome =
  | 'applied'
  | 'unresolvable'
  | 'already-tagged'
  | 'schema-blocked'
  | 'rule-blocked'
  | 'conflict'
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
  /** Populated when apply diagnostics are built (integration layer). */
  diagnostics?: import('./applyDiagnostics').ApplyDiagnosticsReport;
}

const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/** Audit corrections before new insertions; within each tier, prefer longer spans. */
const ACTION_PRIORITY: Partial<Record<SuggestionAction, number>> = {
  'redraw-boundary': 0,
  retag: 1,
  'resolve-date': 1,
  remove: 2,
  add: 3,
};

const TEI_DATE_ATTR_NAMES = new Set(['when', 'from', 'to', 'notBefore', 'notAfter']);
const TEI_DATE_COMPONENT_PATTERNS = [
  /^(-?\d{1,4})(?:([+-][01]\d:[0-5]\d|Z))?$/,
  /^(-?\d{1,4})-([01]\d)(?:([+-][01]\d:[0-5]\d|Z))?$/,
  /^(-?\d{1,4})-([01]\d)-([0-3]\d)(?:([+-][01]\d:[0-5]\d|Z))?$/,
  /^(-?\d{1,4})-([01]\d)-([0-3]\d)T([012]\d):([0-5]\d):([0-5]\d)(\.\d+)?(?:([+-][01]\d:[0-5]\d|Z))?$/,
  /^([0-3]\d)(?:([+-][01]\d:[0-5]\d|Z))?$/,
  /^([012]\d):([0-5]\d):([0-5]\d)(\.\d+)?(?:([+-][01]\d:[0-5]\d|Z))?$/,
  /^([01]\d)(?:([+-][01]\d:[0-5]\d|Z))?$/,
  /^([01]\d)-([0-3]\d)(?:([+-][01]\d:[0-5]\d|Z))?$/,
];

function compareSuggestions(a: Suggestion, b: Suggestion): number {
  const pa = ACTION_PRIORITY[a.action] ?? 99;
  const pb = ACTION_PRIORITY[b.action] ?? 99;
  if (pa !== pb) return pa - pb;
  return b.anchor.surface.length - a.anchor.surface.length;
}

function normalizeTeiDateValue(value: string): string | null {
  const trimmed = value.trim();
  for (const pattern of TEI_DATE_COMPONENT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[0]) {
      const year = match[1]!;
      const suffix = match[2] ?? '';
      const normalizedYear = year.startsWith('-')
        ? `-${year.slice(1).padStart(4, '0')}`
        : year.padStart(4, '0');
      return `${normalizedYear}${suffix}`;
    }
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[1]) {
      const year = match[1]!;
      const month = match[2]!;
      const suffix = match[3] ?? '';
      const normalizedYear = year.startsWith('-')
        ? `-${year.slice(1).padStart(4, '0')}`
        : year.padStart(4, '0');
      return `${normalizedYear}-${month}${suffix}`;
    }
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[2]) {
      const year = match[1]!;
      const month = match[2]!;
      const day = match[3]!;
      const suffix = match[4] ?? '';
      const normalizedYear = year.startsWith('-')
        ? `-${year.slice(1).padStart(4, '0')}`
        : year.padStart(4, '0');
      return `${normalizedYear}-${month}-${day}${suffix}`;
    }
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[3]) {
      const year = match[1]!;
      const month = match[2]!;
      const day = match[3]!;
      const hour = match[4]!;
      const minute = match[5]!;
      const second = match[6]!;
      const fraction = match[7] ?? '';
      const suffix = match[8] ?? '';
      const normalizedYear = year.startsWith('-')
        ? `-${year.slice(1).padStart(4, '0')}`
        : year.padStart(4, '0');
      return `${normalizedYear}-${month}-${day}T${hour}:${minute}:${second}${fraction}${suffix}`;
    }
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[4]) return trimmed;
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[5]) return trimmed;
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[6]) return trimmed;
    if (pattern === TEI_DATE_COMPONENT_PATTERNS[7]) return trimmed;
  }
  return null;
}

function sanitizeResolvedDateAttributes(attrs: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (!TEI_DATE_ATTR_NAMES.has(name)) {
      next[name] = value;
      continue;
    }
    const normalized = normalizeTeiDateValue(value);
    if (!normalized) continue;
    next[name] = normalized;
  }
  return next;
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

  // Spans already claimed by an applied 'add', to block a second, differently
  // tagged 'add' on the same exact span (mutually exclusive alternatives).
  const appliedAddSpans = new Map<string, string>();
  const spanKeyOf = (s: Suggestion) =>
    `${s.anchor.xpath}\t${s.anchor.offset}\t${s.anchor.surface}`;

  const results: ApplyResult[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const suggestion = ordered[index]!;

    if (suggestion.action === 'add') {
      const priorTag = appliedAddSpans.get(spanKeyOf(suggestion));
      if (priorTag !== undefined && priorTag !== suggestion.tag) {
        results.push({ suggestion, outcome: 'conflict' });
        options.onProgress?.(index + 1, ordered.length);
        continue;
      }
    }

    const result = applyOne(doc, suggestion, options);
    if (result.outcome === 'applied' && suggestion.action === 'add') {
      appliedAddSpans.set(spanKeyOf(suggestion), suggestion.tag);
    }
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
    case 'resolve-date':
      return applyResolveDate(doc, suggestion, options);
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

  // Dedup: skip if the same kind already wraps this text (any ancestor of the
  // text node with an equivalent tag — inserting would nest e.g. <roleName>
  // inside <roleName>).
  if (isWrappedByEntityTag(resolved.node, suggestion.tag)) {
    return { suggestion, outcome: 'already-tagged' };
  }

  if (blockedBySchema(schemaTagName(parent), suggestion.tag, options)) {
    return { suggestion, outcome: 'schema-blocked' };
  }
  if (blockedByUserRule(parent, suggestion.tag, options)) {
    return { suggestion, outcome: 'rule-blocked' };
  }
  if (isEntityTagForbiddenInDate(suggestion.tag) && isInsideDateElement(resolved.node)) {
    return { suggestion, outcome: 'rule-blocked' };
  }

  const element = wrapRange(doc, resolved.node, resolved.start, resolved.end, suggestion);
  if (suggestion.dateResolution?.parseXml) {
    replaceDateInnerStructure(doc, element, suggestion.dateResolution.parseXml);
  }
  return { suggestion, outcome: 'applied', element };
}

function applyResolveDate(
  doc: Document,
  suggestion: Suggestion,
  options: ApplyOptions,
): ApplyResult {
  const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!resolved) return { suggestion, outcome: 'unresolvable' };

  let dateEl: Element | null = resolved.node.parentElement;
  while (dateEl && dateEl.localName !== 'date') {
    dateEl = dateEl.parentElement;
  }
  if (!dateEl) return { suggestion, outcome: 'unresolvable' };

  for (const [name, value] of Object.entries(sanitizeResolvedDateAttributes(suggestion.attributes ?? {}))) {
    dateEl.setAttribute(name, value);
  }

  if (suggestion.dateResolution?.parseXml) {
    replaceDateInnerStructure(doc, dateEl, suggestion.dateResolution.parseXml);
  }

  return { suggestion, outcome: 'applied', element: dateEl };
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
  if (blockedBySchema(schemaTagName(parent), suggestion.tag, options)) {
    return { suggestion, outcome: 'schema-blocked' };
  }
  if (blockedByUserRule(parent, suggestion.tag, options)) {
    return { suggestion, outcome: 'rule-blocked' };
  }
  if (isEntityTagForbiddenInDate(suggestion.tag) && isInsideDateElement(resolved.node)) {
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

  if (isEntityTagForbiddenInDate(suggestion.tag) && isInsideDateElement(resolved.node)) {
    return { suggestion, outcome: 'rule-blocked' };
  }

  const wrapper = findTagWrapper(resolved.node, suggestion.tag);
  if (!wrapper) return { suggestion, outcome: 'unresolvable' };

  const parent = wrapper.parentElement;
  if (!parent) return { suggestion, outcome: 'unresolvable' };

  unwrapElement(wrapper);

  const reResolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!reResolved) return { suggestion, outcome: 'unresolvable' };

  const insertParent = reResolved.node.parentElement;
  if (!insertParent) return { suggestion, outcome: 'unresolvable' };
  if (blockedBySchema(schemaTagName(insertParent), suggestion.tag, options)) {
    return { suggestion, outcome: 'schema-blocked' };
  }
  if (blockedByUserRule(insertParent, suggestion.tag, options)) {
    return { suggestion, outcome: 'rule-blocked' };
  }
  if (isEntityTagForbiddenInDate(suggestion.tag) && isInsideDateElement(reResolved.node)) {
    return { suggestion, outcome: 'rule-blocked' };
  }

  const element = wrapRange(doc, reResolved.node, reResolved.start, reResolved.end, suggestion);
  return { suggestion, outcome: 'applied', element };
}

/** Tag name for schema checks (namespace-safe). */
function schemaTagName(el: Element): string {
  return el.localName || el.nodeName;
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
  'org',
  'geogName',
  'name',
  'roleName',
  'title',
  'date',
]);

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

/** Replace bare text inside `<date>` with sanmiao parse children (era, year, …). */
function replaceDateInnerStructure(doc: Document, element: Element, innerXml: string): void {
  const teiNs = doc.documentElement?.namespaceURI ?? 'http://www.tei-c.org/ns/1.0';
  const wrapped = `<wrapper xmlns="${teiNs}">${innerXml}</wrapper>`;
  const parsed = new DOMParser().parseFromString(wrapped, 'application/xml');
  const wrapper = parsed.documentElement;
  if (!wrapper || parsed.getElementsByTagName('parsererror').length > 0) return;

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  for (const child of Array.from(wrapper.childNodes)) {
    element.appendChild(doc.importNode(child, true));
  }
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
