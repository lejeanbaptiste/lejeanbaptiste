import { resolveAnchor, resolveXPath } from './anchor';
import { isEntityTagForbiddenInDate, isInsideDateElement } from './dateTeiHelpers';
import {
  projectionSpanIsInsideDate,
  resolveProjectionAdd,
  wrapProjectionRange,
} from './projectionApply';
import { validatePersonWrappers, type PersonWrapperValidation } from './personWrapperValidation';
import {
  ancestorTagsOf,
  isWrappedByEntityTag,
  removeNestedSameTagElements,
  sanitizeGeneratedFragment,
} from './suggestionFilters';
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
  /** LJB wrapper validation after the batch; pending cert=unknown is reported separately. */
  personWrapperValidation?: PersonWrapperValidation;
  /**
   * Set when the document's total text content length changed across the
   * batch — autotagging must only add markup, never add or remove source
   * text. The per-suggestion guard in `applyAdd` should catch this before it
   * happens; this is the coarser net behind it, covering any other path that
   * might someday do the same thing. Callers should surface this prominently
   * (it means something is wrong) rather than silently swallow it.
   */
  textIntegrityWarning?: string;
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
  'add-compound': 3,
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
  // Normalize both documents loaded from disk and markup produced by another
  // producer before the result is handed to schema validation.
  removeNestedSameTagElements(doc);
  const ordered = [...suggestions].sort(compareSuggestions);

  // Spans already claimed by an applied 'add', to block a second, differently
  // tagged 'add' on the same exact span (mutually exclusive alternatives).
  const appliedAddSpans = new Map<string, string>();
  const spanKeyOf = (s: Suggestion) => `${s.anchor.xpath}\t${s.anchor.offset}\t${s.anchor.surface}`;

  const textLength = (): number => doc.documentElement?.textContent?.length ?? 0;
  const textIntegrityIssues: string[] = [];

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

    const lengthBefore = textLength();
    const result = applyOne(doc, suggestion, options);
    const delta = textLength() - lengthBefore;
    // 'dates' (sanmiao date resolution) has its own, separately-established
    // norms — it can legitimately drop a redundant character (e.g. a dynasty
    // prefix already recorded elsewhere) when normalizing a ruler reference.
    // Every other source is expected to only add markup, never change text.
    if (result.outcome === 'applied' && delta !== 0 && suggestion.source !== 'dates') {
      const message =
        `Suggestion ${suggestion.id} (tag=${suggestion.tag}, source=${suggestion.source}) changed ` +
        `the document's text length by ${delta > 0 ? '+' : ''}${delta} character(s) when applied — ` +
        'autotagging must only add markup, never add or remove source text. This indicates a bug.';
      console.error(`[autoTagging] ${message}`);
      textIntegrityIssues.push(message);
    }

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

  // Compound/retag producers can move existing elements around, so run the
  // cleanup again after all mutations as the final pre-validation step.
  removeNestedSameTagElements(doc);

  const textIntegrityWarning =
    textIntegrityIssues.length > 0 ? textIntegrityIssues.join('\n') : undefined;

  return {
    results,
    applied: results.filter((r) => r.outcome === 'applied').length,
    snapshot,
    personWrapperValidation: validatePersonWrappers(doc),
    textIntegrityWarning,
  };
}

export interface StaleCheckResult {
  stale: boolean;
  reason?: string;
}

/**
 * Non-mutating check of whether a still-pending `add`/`add-compound`
 * suggestion would still apply against the current document — i.e. it
 * hasn't been tagged by the user in the meantime, and wouldn't now violate
 * the schema or a tagging rule (e.g. its span ended up inside a `<date>`).
 * Other actions (retag/remove/resolve-date/redraw-boundary) aren't re-checked
 * here: they target existing markup and are cheap to just retry at apply time.
 */
export function checkSuggestionStillApplicable(
  doc: Document,
  suggestion: Suggestion,
  options: ApplyOptions,
): StaleCheckResult {
  if (suggestion.action === 'add-compound') {
    const resolved = resolveCompoundAdd(doc, suggestion, options);
    return resolved.ok ? { stale: false } : { stale: true, reason: resolved.reason };
  }
  if (suggestion.action === 'add' && suggestion.anchor.endXpath) {
    const resolved = resolveProjectionAdd(doc, suggestion.anchor, options.policy);
    if (!resolved.ok) return { stale: true, reason: resolved.reason };
    if (isWrappedByEntityTag(resolved.startNode, suggestion.tag)) {
      return { stale: true, reason: `already tagged as <${suggestion.tag}>` };
    }
    if (blockedBySchema(schemaTagName(resolved.parent), suggestion.tag, options)) {
      return { stale: true, reason: `schema no longer allows <${suggestion.tag}> here` };
    }
    if (blockedByUserRule(resolved.parent, suggestion.tag, options)) {
      return { stale: true, reason: `blocked by a user tagging rule for <${suggestion.tag}>` };
    }
    if (
      isEntityTagForbiddenInDate(suggestion.tag) &&
      projectionSpanIsInsideDate(resolved.startNode, resolved.endNode)
    ) {
      return { stale: true, reason: 'now inside a <date> element' };
    }
    return { stale: false };
  }
  if (suggestion.action !== 'add') return { stale: false };

  const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
  if (!resolved) return { stale: true, reason: 'anchor no longer resolves in the document' };
  const parent = resolved.node.parentElement;
  if (!parent) return { stale: true, reason: 'anchor has no parent element' };
  if (isWrappedByEntityTag(resolved.node, suggestion.tag)) {
    return { stale: true, reason: `already tagged as <${suggestion.tag}>` };
  }
  if (blockedBySchema(schemaTagName(parent), suggestion.tag, options)) {
    return { stale: true, reason: `schema no longer allows <${suggestion.tag}> here` };
  }
  if (blockedByUserRule(parent, suggestion.tag, options)) {
    return { stale: true, reason: `blocked by a user tagging rule for <${suggestion.tag}>` };
  }
  if (isEntityTagForbiddenInDate(suggestion.tag) && isInsideDateElement(resolved.node)) {
    return { stale: true, reason: 'now inside a <date> element' };
  }
  return { stale: false };
}

/**
 * Re-check every still-pending suggestion against the live document (the
 * review panel's Refresh button): suggestions that were tagged by the user
 * in the meantime, or would now be schema/rule-blocked, are marked
 * unresolvable rather than removed, so counts stay honest.
 */
export function revalidatePendingSuggestions(
  doc: Document,
  suggestions: Suggestion[],
  options: ApplyOptions,
): { staleCount: number } {
  let staleCount = 0;
  for (const suggestion of suggestions) {
    if (suggestion.status !== 'pending') continue;
    if (checkSuggestionStillApplicable(doc, suggestion, options).stale) {
      suggestion.status = 'unresolvable';
      staleCount++;
    }
  }
  return { staleCount };
}

function applyOne(doc: Document, suggestion: Suggestion, options: ApplyOptions): ApplyResult {
  switch (suggestion.action) {
    case 'add':
      return applyAdd(doc, suggestion, options);
    case 'add-compound':
      return applyCompoundAdd(doc, suggestion, options);
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

export type CompoundAddResolution =
  | { ok: true; parent: Element; first: Element; last: Element }
  | { ok: false; outcome: ApplyOutcome; reason: string };

/**
 * Resolve (without mutating) the contiguous run of already-tagged sibling
 * components a person-wrapper `add-compound` suggestion would wrap. Shared
 * by {@link applyCompoundAdd} and the diagnostics/refresh paths so the
 * explanation of a failure is the actual reason it failed, not a guess.
 */
export function resolveCompoundAdd(
  doc: Document,
  suggestion: Suggestion,
  options: ApplyOptions,
): CompoundAddResolution {
  if (!suggestion.anchor.endXpath || suggestion.anchor.endOffset === undefined) {
    return { ok: false, outcome: 'unresolvable', reason: 'anchor is missing its end boundary' };
  }
  const startNode = resolveXPath(doc, suggestion.anchor.xpath);
  const endNode = resolveXPath(doc, suggestion.anchor.endXpath);
  if (!startNode || !endNode) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'xpath no longer resolves for the wrapper span',
    };
  }
  const start = { node: startNode, start: suggestion.anchor.offset };
  const endOffset = suggestion.anchor.endOffset;
  if (endOffset < 0 || endOffset > endNode.data.length) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'end offset is no longer within its node',
    };
  }

  const commonParent = nearestCommonElement(start.node, endNode);
  const first = directChildContaining(start.node, commonParent);
  const last = directChildContaining(endNode, commonParent);
  if (!commonParent || !first || !last || first === last || first.parentNode !== last.parentNode) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'the wrapper components are no longer adjacent siblings',
    };
  }
  const parent = first.parentElement;
  if (!parent) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'wrapper components have no parent element',
    };
  }
  if (blockedBySchema(schemaTagName(parent), suggestion.tag, options)) {
    return {
      ok: false,
      outcome: 'schema-blocked',
      reason: `schema does not allow <${suggestion.tag}> here`,
    };
  }
  if (blockedByUserRule(parent, suggestion.tag, options)) {
    return {
      ok: false,
      outcome: 'rule-blocked',
      reason: `blocked by a user tagging rule for <${suggestion.tag}>`,
    };
  }
  if (isInsideDateElement(start.node) || isInsideDateElement(endNode)) {
    return {
      ok: false,
      outcome: 'rule-blocked',
      reason: 'wrapper span is now inside a <date> element',
    };
  }
  if (findAncestorTag(start.node, suggestion.tag)) {
    return {
      ok: false,
      outcome: 'already-tagged',
      reason: `already inside a <${suggestion.tag}> element`,
    };
  }

  const firstText = firstTextDescendant(first);
  const lastText = lastTextDescendant(last);
  if (
    firstText !== start.node ||
    start.start !== 0 ||
    lastText !== endNode ||
    endOffset !== endNode.data.length
  ) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'the wrapper span no longer exactly bounds its tagged components',
    };
  }

  return { ok: true, parent, first, last };
}

/** Wrap a contiguous run of already-tagged sibling components in a person wrapper. */
function applyCompoundAdd(
  doc: Document,
  suggestion: Suggestion,
  options: ApplyOptions,
): ApplyResult {
  const resolved = resolveCompoundAdd(doc, suggestion, options);
  if (!resolved.ok) return { suggestion, outcome: resolved.outcome };
  const { parent, first, last } = resolved;

  const element = doc.createElementNS(doc.documentElement?.namespaceURI ?? null, suggestion.tag);
  for (const [name, value] of Object.entries(suggestion.attributes ?? {}))
    element.setAttribute(name, value);
  parent.insertBefore(element, first);
  let current: ChildNode | null = first;
  while (current) {
    const next: ChildNode | null = current.nextSibling;
    element.appendChild(current);
    if (current === last) break;
    current = next;
  }
  return { suggestion, outcome: 'applied', element };
}

function directChildContaining(node: Node, parent: Element | null): Element | null {
  if (!parent) return null;
  let current: Node | null = node;
  while (current && current.parentNode !== parent) current = current.parentNode;
  return current instanceof Element ? current : null;
}

function nearestCommonElement(a: Node, b: Node): Element | null {
  const ancestors = new Set<Element>();
  for (let el = a.parentElement; el; el = el.parentElement) ancestors.add(el);
  for (let el = b.parentElement; el; el = el.parentElement) {
    if (ancestors.has(el)) return el;
  }
  return null;
}

function firstTextDescendant(element: Element): Text | null {
  const walker = element.ownerDocument!.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  return (walker.nextNode() as Text | null) ?? null;
}

function lastTextDescendant(element: Element): Text | null {
  const walker = element.ownerDocument!.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let node = walker.nextNode();
  while (node) {
    last = node as Text;
    node = walker.nextNode();
  }
  return last;
}

function findAncestorTag(node: Node, tag: string): Element | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.nodeName === tag) return el;
  }
  return null;
}

function applyAdd(doc: Document, suggestion: Suggestion, options: ApplyOptions): ApplyResult {
  if (suggestion.anchor.endXpath && suggestion.anchor.endOffset !== undefined) {
    return applyProjectionAdd(doc, suggestion, options);
  }

  // Safety net: a compound suggestion's innerXml is built from authority
  // metadata (see seed.ts), separately from the text the anchor actually
  // matched. If the two ever drift — one authority record sharing several
  // search-string forms behind one metadata object is exactly how they can —
  // applying it would splice characters into the document that were never in
  // the source. Verify before touching the DOM at all, rather than after.
  if (suggestion.innerXml) {
    const reconstructed = plainTextOfXmlFragment(doc, suggestion.innerXml);
    if (reconstructed !== suggestion.anchor.surface) {
      console.error(
        '[autoTagging] Refused a compound suggestion whose innerXml text does not match the matched surface — applying it would rewrite source text.',
        {
          suggestionId: suggestion.id,
          tag: suggestion.tag,
          sourceDetail: suggestion.sourceDetail,
          matchedSurface: suggestion.anchor.surface,
          reconstructedFromInnerXml: reconstructed,
          innerXml: suggestion.innerXml,
        },
      );
      return { suggestion, outcome: 'conflict' };
    }
  }

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
  if (suggestion.innerXml) {
    replaceInnerStructure(doc, element, suggestion.innerXml, ancestorTagsOf(element));
  }
  if (suggestion.dateResolution?.parseXml) {
    replaceDateInnerStructure(
      doc,
      element,
      suggestion.dateResolution.parseXml,
      ancestorTagsOf(element),
    );
  }
  return { suggestion, outcome: 'applied', element };
}

function applyProjectionAdd(
  doc: Document,
  suggestion: Suggestion,
  options: ApplyOptions,
): ApplyResult {
  const resolved = resolveProjectionAdd(doc, suggestion.anchor, options.policy);
  if (!resolved.ok) return { suggestion, outcome: resolved.outcome };

  const { parent, startNode, startOffset, endNode, endOffset } = resolved;

  if (isWrappedByEntityTag(startNode, suggestion.tag)) {
    return { suggestion, outcome: 'already-tagged' };
  }
  if (blockedBySchema(schemaTagName(parent), suggestion.tag, options)) {
    return { suggestion, outcome: 'schema-blocked' };
  }
  if (blockedByUserRule(parent, suggestion.tag, options)) {
    return { suggestion, outcome: 'rule-blocked' };
  }
  if (
    isEntityTagForbiddenInDate(suggestion.tag) &&
    projectionSpanIsInsideDate(startNode, endNode)
  ) {
    return { suggestion, outcome: 'rule-blocked' };
  }
  if (findAncestorTag(startNode, suggestion.tag)) {
    return { suggestion, outcome: 'already-tagged' };
  }

  const element = wrapProjectionRange(doc, startNode, startOffset, endNode, endOffset, suggestion);
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

  for (const [name, value] of Object.entries(
    sanitizeResolvedDateAttributes(suggestion.attributes ?? {}),
  )) {
    dateEl.setAttribute(name, value);
  }

  if (suggestion.dateResolution?.parseXml) {
    replaceDateInnerStructure(
      doc,
      dateEl,
      suggestion.dateResolution.parseXml,
      ancestorTagsOf(dateEl),
    );
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

/**
 * Replace bare text inside `<date>` with sanmiao parse children (era, year,
 * …). Sanitized against `ancestorTags` before insertion: sanmiao's own output
 * is an external producer and is not otherwise checked against our schema, so
 * this is the only guard against e.g. a `<persName>` it emits ending up
 * inside `<ruler>` (whose content model is text/model.global only).
 */
function replaceDateInnerStructure(
  doc: Document,
  element: Element,
  innerXml: string,
  ancestorTags: readonly string[],
): void {
  const teiNs = doc.documentElement?.namespaceURI ?? 'http://www.tei-c.org/ns/1.0';
  const wrapped = `<wrapper xmlns="${teiNs}">${innerXml}</wrapper>`;
  const parsed = new DOMParser().parseFromString(wrapped, 'application/xml');
  const wrapper = parsed.documentElement;
  if (!wrapper || parsed.getElementsByTagName('parsererror').length > 0) return;
  sanitizeGeneratedFragment(wrapper, ancestorTags, true);

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  for (const child of Array.from(wrapper.childNodes)) {
    element.appendChild(doc.importNode(child, true));
  }
}

/**
 * Plain text a compound suggestion's `innerXml` would contribute, parsed the
 * same way `replaceInnerStructure` parses it — so this reflects exactly what
 * would land in the document, not an approximation of it. Returns null on a
 * parse failure (also treated as "don't apply" by the caller).
 */
function plainTextOfXmlFragment(doc: Document, innerXml: string): string | null {
  const teiNs = doc.documentElement?.namespaceURI ?? 'http://www.tei-c.org/ns/1.0';
  const wrapped = `<wrapper xmlns="${teiNs}">${innerXml}</wrapper>`;
  const parsed = new DOMParser().parseFromString(wrapped, 'application/xml');
  if (!parsed.documentElement || parsed.getElementsByTagName('parsererror').length > 0) return null;
  return parsed.documentElement.textContent;
}

/**
 * Replace the text child of a compound suggestion (nobleTitle / personWrapper)
 * with its generated TEI structure, sanitized against `ancestorTags` first —
 * e.g. a nobleTitle's `<roleName>` component must not land inside a
 * pre-existing `<roleName>` ancestor at the insertion point.
 */
function replaceInnerStructure(
  doc: Document,
  element: Element,
  innerXml: string,
  ancestorTags: readonly string[],
): void {
  const teiNs = doc.documentElement?.namespaceURI ?? 'http://www.tei-c.org/ns/1.0';
  const wrapped = `<wrapper xmlns="${teiNs}">${innerXml}</wrapper>`;
  const parsed = new DOMParser().parseFromString(wrapped, 'application/xml');
  const wrapper = parsed.documentElement;
  if (!wrapper || parsed.getElementsByTagName('parsererror').length > 0) return;
  sanitizeGeneratedFragment(wrapper, ancestorTags, ancestorTags.includes('date'));

  while (element.firstChild) element.removeChild(element.firstChild);
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

/**
 * When a persName inside a keyless Norbert person wrapper is resolved (e.g.
 * via the normal disambiguation panel, some time after Group and Clean left
 * it pending), copy the resolved key up to the wrapper immediately — the
 * wrapper is otherwise never picked up by anything since it has no @key.
 */
function copyKeyToUnkeyedPersonWrapper(element: Element, entityId: string): void {
  const parent = element.parentElement;
  if (!parent) return;
  if ((parent.localName || parent.nodeName) !== 'name') return;
  if (parent.getAttribute('type') !== 'personWrapper') return;
  if (parent.getAttribute('key')?.trim()) return;
  parent.setAttribute('key', entityId);
  parent.removeAttribute('cert');
}

/** Assign a local entity id to an already-tagged mention element. */
export function assignEntity(input: AssignEntityInput): AssignEntityResult {
  const { element, entityId, resp } = input;
  element.setAttribute('key', entityId);
  element.removeAttribute('cert');
  if (resp) element.setAttribute('resp', resp);
  copyKeyToUnkeyedPersonWrapper(element, entityId);
  return { action: 'assign-entity', entityId, element };
}

/** Mark a mention unresolved without removing the tag. */
export function markUnresolved(element: Element): MarkUnresolvedResult {
  element.removeAttribute('key');
  element.setAttribute('cert', 'unknown');
  return { action: 'mark-unresolved', element };
}
