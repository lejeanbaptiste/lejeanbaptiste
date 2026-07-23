import { buildDocIndex, type DocIndex } from './anchor';
import type { Suggestion, WhitespacePolicy } from './types';

/** TEI tags that represent the same entity kind for skip/filter purposes. */
export const ENTITY_TAG_EQUIVALENTS: ReadonlyMap<string, readonly string[]> = new Map([
  ['placeName', ['placeName', 'geogName']],
  ['geogName', ['placeName', 'geogName']],
  ['orgName', ['orgName', 'org']],
  ['org', ['orgName', 'org']],
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

/** True when `node` sits inside an entity wrapper equivalent to `tag`. */
export function isWrappedByEntityTag(node: Node, tag: string): boolean {
  const names = new Set(entityTagNamesFor(tag));
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (names.has(elementLocalTag(el))) return true;
  }
  return false;
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

/** Deduplicate suggestions by their document location (tag, surface, xpath, offset). */
export function dedupeSuggestionsByLocation(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Map<string, Suggestion>();
  for (const suggestion of suggestions) {
    const anchor = suggestion.anchor;
    const key = `${suggestion.tag}\t${anchor.surface}\t${anchor.xpath}\t${anchor.offset}`;
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

  type SpannedAdd = { suggestion: Suggestion; start: number; end: number; length: number };
  const spanned: SpannedAdd[] = [];
  const unresolvable = new Set<Suggestion>();
  for (const suggestion of adds) {
    const span = docSpanAt(index.text, suggestion.anchor.surface, suggestion.anchor.occurrence);
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

  const keptSpans: TaggedSpan[] = existing.map((span) => ({ ...span }));
  const keptAdds = new Set<Suggestion>();
  let dropped = 0;

  for (const row of spanned) {
    const nested = keptSpans.some(
      (t) =>
        entityTagsEquivalent(t.tag, row.suggestion.tag) &&
        row.start >= t.start &&
        row.end <= t.end,
    );
    if (nested) {
      dropped++;
      continue;
    }
    keptAdds.add(row.suggestion);
    keptSpans.push({ start: row.start, end: row.end, tag: row.suggestion.tag });
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
