import { buildDocIndex, resolveXPath, type DocIndex } from './anchor';
import type { Anchor } from './types';
import { isEntityTagForbiddenInDate } from './dateTeiHelpers';
import type { Suggestion, WhitespacePolicy } from './types';

/** TEI tags that represent the same entity kind for skip/filter purposes. */
export const ENTITY_TAG_EQUIVALENTS: ReadonlyMap<string, readonly string[]> = new Map([
  ['placeName', ['placeName', 'geogName']],
  ['geogName', ['placeName', 'geogName']],
  ['orgName', ['orgName', 'org']],
  ['org', ['orgName', 'org']],
]);

/**
 * Nestings TEI's RelaxNG grammar structurally permits (phrase-level tags are
 * broadly cross-nestable via `model.phrase`) but that are never editorially
 * valid for this project. Enforced regardless of what the live schema allows.
 */
export const FORBIDDEN_ENTITY_NESTING: ReadonlyMap<string, readonly string[]> = new Map([
  ['title', ['roleName', 'placeName', 'persName']],
]);

export function elementLocalTag(el: Element): string {
  return el.localName || el.nodeName;
}

export function entityTagNamesFor(tag: string): readonly string[] {
  return ENTITY_TAG_EQUIVALENTS.get(tag) ?? [tag];
}

export function entityTagsEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  const group = ENTITY_TAG_EQUIVALENTS.get(a);
  return group != null && group.includes(b);
}

function isForbiddenNesting(ancestorTag: string, childTag: string): boolean {
  return FORBIDDEN_ENTITY_NESTING.get(childTag)?.includes(ancestorTag) ?? false;
}

/**
 * True when inserting an element tagged any of `tags` at `node` would nest
 * inside an ancestor of the same (or equivalent) entity kind, or violate a
 * {@link FORBIDDEN_ENTITY_NESTING} rule against an ancestor.
 */
export function isNestingBlocked(node: Node, tags: Iterable<string>): boolean {
  const tagList = [...tags];
  for (let el = node.parentElement; el; el = el.parentElement) {
    const ancestorTag = elementLocalTag(el);
    for (const tag of tagList) {
      if (entityTagsEquivalent(ancestorTag, tag)) return true;
      if (isForbiddenNesting(ancestorTag, tag)) return true;
    }
  }
  return false;
}

/** True when `node` sits inside an entity wrapper equivalent to `tag`, or
 * inside an ancestor that forbids nesting `tag` beneath it. */
export function isWrappedByEntityTag(node: Node, tag: string): boolean {
  return isNestingBlocked(node, [tag]);
}

/** Local tag names of `element` itself plus every ancestor, outward. */
export function ancestorTagsOf(element: Element): string[] {
  const tags: string[] = [elementLocalTag(element)];
  for (let el = element.parentElement; el; el = el.parentElement) tags.push(elementLocalTag(el));
  return tags;
}

/**
 * Recursively unwrap descendants of `root` that would violate containment
 * once `root` is spliced in at a position whose tag chain is `ancestorTags`
 * (host element outward). Applies three checks, all defense against a
 * producer (compound-wrapper builders, sanmiao date resolution) generating
 * XML that a naive splice would insert unchecked:
 *  - same/equivalent-tag self-nesting (schema allows it, editors never want it)
 *  - {@link FORBIDDEN_ENTITY_NESTING} pairs
 *  - entity tags forbidden anywhere inside a `<date>` (when `insideDate`, or
 *    once a descendant `<date>` is entered)
 * Unwrapping preserves the offending element's own children/text in place.
 */
export function sanitizeGeneratedFragment(
  root: Element,
  ancestorTags: readonly string[],
  insideDate = false,
): void {
  for (const child of Array.from(root.children)) {
    const tag = elementLocalTag(child);
    const blocked =
      ancestorTags.some((a) => entityTagsEquivalent(a, tag) || isForbiddenNesting(a, tag)) ||
      (insideDate && isEntityTagForbiddenInDate(tag));
    if (blocked) {
      child.replaceWith(...Array.from(child.childNodes));
      // Structure changed under `root` — re-scan its current children.
      sanitizeGeneratedFragment(root, ancestorTags, insideDate);
      return;
    }
    sanitizeGeneratedFragment(child, [...ancestorTags, tag], insideDate || tag === 'date');
  }
}

export interface TaggedSpan {
  start: number;
  end: number;
  tag: string;
}

function textRangeForElement(el: Element, index: DocIndex): { start: number; end: number } | null {
  const walker = el.ownerDocument!.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let first: number | null = null;
  let lastEnd: number | null = null;
  let node = walker.nextNode();
  while (node) {
    const nodeIdx = index.nodes.findIndex((n) => n.node === node);
    if (nodeIdx !== -1) {
      const start = index.nodeStart[nodeIdx]!;
      const end = start + index.nodes[nodeIdx]!.search.text.length;
      if (first === null) first = start;
      lastEnd = end;
    }
    node = walker.nextNode();
  }
  if (first === null || lastEnd === null) return null;
  return { start: first, end: lastEnd };
}

function expandTagSetForNestedFilter(tags: Iterable<string>): Set<string> {
  const expanded = new Set<string>();
  for (const tag of tags) {
    for (const name of entityTagNamesFor(tag)) expanded.add(name);
  }
  return expanded;
}

/** Document-level spans for existing entity tags (includes mixed-content wrappers). */
export function collectTaggedSpans(
  doc: Document,
  index: DocIndex,
  tagSet: Set<string>,
): TaggedSpan[] {
  const expanded = expandTagSetForNestedFilter(tagSet);
  const walker = doc.createTreeWalker(doc.documentElement ?? doc, NodeFilter.SHOW_ELEMENT);
  const spans: TaggedSpan[] = [];
  let el = walker.nextNode() as Element | null;
  while (el) {
    const tag = elementLocalTag(el);
    if (expanded.has(tag)) {
      const range = textRangeForElement(el, index);
      if (range) spans.push({ ...range, tag });
    }
    el = walker.nextNode() as Element | null;
  }
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Unwrap same-type tags nested inside another same-type tag.
 *
 * Auto-tagging normally filters duplicate additions, but documents can still
 * arrive with nested markup (or acquire it through a producer that does not
 * use the normal add path). Same-type nesting is never useful to the editor:
 * remove the inner wrapper while preserving all of its children.
 */
export function removeNestedSameTagElements(doc: Document): number {
  let removed = 0;
  const elements = Array.from(doc.querySelectorAll('*'));

  for (const element of elements) {
    const tag = elementLocalTag(element);
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (elementLocalTag(ancestor) !== tag) continue;
      element.replaceWith(...Array.from(element.childNodes));
      removed++;
      break;
    }
  }

  return removed;
}

function docSpanAt(
  text: string,
  surface: string,
  occurrence: number,
): { start: number; end: number } | null {
  let count = 0;
  let idx = text.indexOf(surface);
  while (idx !== -1) {
    count++;
    if (count === occurrence) return { start: idx, end: idx + surface.length };
    idx = text.indexOf(surface, idx + 1);
  }
  return null;
}

/** Map an anchor to document-level search-text offsets for nested-span checks. */
function docSpanFromAnchor(
  doc: Document,
  index: DocIndex,
  anchor: Anchor,
): { start: number; end: number } | null {
  if (anchor.endXpath != null && anchor.endOffset != null) {
    const startNode = resolveXPath(doc, anchor.xpath);
    const endNode = resolveXPath(doc, anchor.endXpath);
    if (!startNode || !endNode) return null;

    const startNodeIdx = index.nodes.findIndex((n) => n.node === startNode);
    const endNodeIdx = index.nodes.findIndex((n) => n.node === endNode);
    if (startNodeIdx < 0 || endNodeIdx < 0) return null;

    const startSearch = index.nodes[startNodeIdx]!.search;
    const endSearch = index.nodes[endNodeIdx]!.search;
    const startSearchIdx = startSearch.map.findIndex((raw) => raw >= anchor.offset);
    if (startSearchIdx < 0) return null;

    let endSearchEnd = endSearch.map.length;
    for (let i = 0; i < endSearch.map.length; i++) {
      if (endSearch.map[i]! >= anchor.endOffset) {
        endSearchEnd = i;
        break;
      }
    }
    if (endSearchEnd <= startSearchIdx && startNodeIdx === endNodeIdx) return null;

    const start = index.nodeStart[startNodeIdx]! + startSearchIdx;
    const end = index.nodeStart[endNodeIdx]! + endSearchEnd;
    if (end <= start) return null;
    return { start, end };
  }

  return docSpanAt(index.text, anchor.surface, anchor.occurrence);
}

/** Deduplicate suggestions by their document location (tag, surface, xpath, offset, entity key). */
export function suggestionLocationKey(suggestion: Suggestion): string {
  const anchor = suggestion.anchor;
  const entityKey = suggestion.attributes?.key ?? '';
  const typeAttr = suggestion.attributes?.type ?? '';
  return `${suggestion.tag}\t${typeAttr}\t${anchor.surface}\t${anchor.xpath}\t${anchor.offset}\t${anchor.endXpath ?? ''}\t${anchor.endOffset ?? ''}\t${entityKey}`;
}

export function dedupeSuggestionsByLocation(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Map<string, Suggestion>();
  for (const suggestion of suggestions) {
    const key = suggestionLocationKey(suggestion);
    if (!seen.has(key)) seen.set(key, suggestion);
  }
  return [...seen.values()];
}

/**
 * Drop `add` suggestions that would nest (or duplicate) a mark of the same
 * kind — either an existing document wrapper, or a longer sibling suggestion
 * in this batch. E.g. add 行成 as persName when 行成 is already inside
 * <persName>張行成</persName>, or suggest roleName「知政事」 when the batch
 * also suggests roleName「參知政事」 spanning the same text. Applied before
 * the review panel. Longer / outer wins; same-kind inside same-kind is never
 * offered.
 */
export function filterNestedSameTagAdds(
  doc: Document,
  policy: WhitespacePolicy,
  suggestions: Suggestion[],
): { suggestions: Suggestion[]; dropped: number } {
  const adds = suggestions.filter((s) => s.action === 'add');
  if (adds.length === 0) return { suggestions, dropped: 0 };

  const index = buildDocIndex(doc, policy);
  const tagSet = new Set(adds.map((s) => s.tag));
  const existing = collectTaggedSpans(doc, index, tagSet);

  interface SpannedAdd {
    suggestion: Suggestion;
    start: number;
    end: number;
    length: number;
  }
  const spanned: SpannedAdd[] = [];
  const unresolvable = new Set<Suggestion>();
  for (const suggestion of adds) {
    const span = docSpanFromAnchor(doc, index, suggestion.anchor);
    if (!span) {
      unresolvable.add(suggestion);
      continue;
    }
    spanned.push({
      suggestion,
      start: span.start,
      end: span.end,
      length: span.end - span.start,
    });
  }

  // Longer first so the outer span is kept, then the inner is rejected as nested.
  spanned.sort((a, b) => b.length - a.length || a.start - b.start);

  const keptBatchSpans: { start: number; end: number; tag: string; entityKey?: string }[] = [];
  const keptAdds = new Set<Suggestion>();
  let dropped = 0;

  for (const row of spanned) {
    const nestedInDocument = existing.some(
      (t) =>
        entityTagsEquivalent(t.tag, row.suggestion.tag) && row.start >= t.start && row.end <= t.end,
    );
    if (nestedInDocument) {
      dropped++;
      continue;
    }

    const rowKey = row.suggestion.attributes?.key;
    const blockedByBatch = keptBatchSpans.some((t) => {
      if (!entityTagsEquivalent(t.tag, row.suggestion.tag)) return false;
      if (row.start < t.start || row.end > t.end) return false;
      if (
        row.start === t.start &&
        row.end === t.end &&
        rowKey &&
        t.entityKey &&
        rowKey !== t.entityKey
      ) {
        return false;
      }
      return true;
    });
    if (blockedByBatch) {
      dropped++;
      continue;
    }

    keptAdds.add(row.suggestion);
    keptBatchSpans.push({
      start: row.start,
      end: row.end,
      tag: row.suggestion.tag,
      entityKey: rowKey,
    });
  }

  const kept = suggestions.filter((s) => {
    if (s.action !== 'add') return true;
    if (unresolvable.has(s)) return true;
    return keptAdds.has(s);
  });

  return { suggestions: kept, dropped };
}

export interface PrepareSuggestionsResult {
  suggestions: Suggestion[];
  droppedNested: number;
  droppedDuplicate: number;
}

/** Final cleanup every producer should pass through before review. */
export function prepareSuggestionsForReview(
  doc: Document,
  policy: WhitespacePolicy,
  suggestions: Suggestion[],
): PrepareSuggestionsResult {
  const { suggestions: nestedFiltered, dropped: droppedNested } = filterNestedSameTagAdds(
    doc,
    policy,
    suggestions,
  );
  const deduped = dedupeSuggestionsByLocation(nestedFiltered);
  return {
    suggestions: deduped,
    droppedNested,
    droppedDuplicate: nestedFiltered.length - deduped.length,
  };
}
