import type { DictionaryEntry } from './dictionary';
import { findTeiBodyRoot } from './dates';
import { buildSearchText } from './normalize';
import type { WhitespacePolicy } from './types';

/** TEI named-entity elements crawled by default when no tag list is given. */
export const DEFAULT_CRAWL_TAGS = [
  'persName',
  'placeName',
  'orgName',
  'org',
  'geogName',
  'name',
  'roleName',
  'title',
];

function isInsideDateElement(el: Element): boolean {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    if (cur.localName === 'date') return true;
  }
  return false;
}

/**
 * Compile a dictionary from entities already tagged in a document: each
 * distinct (surface, tag) becomes an entry, so untagged occurrences of the
 * same string elsewhere can be tagged the same way.
 *
 * Tag stage only: existing @key/@ref values are deliberately NOT read or
 * propagated — identity is handled later, at disambiguation. Surfaces are
 * normalized with the same whitespace policy the producer uses, so they match
 * the document's search text.
 */
export function crawlEntities(
  doc: Document,
  policy: WhitespacePolicy,
  tags: string[] = DEFAULT_CRAWL_TAGS,
): DictionaryEntry[] {
  const bodyRoot = findTeiBodyRoot(doc);
  const bySurfaceTag = new Map<string, DictionaryEntry>();

  for (const tag of tags) {
    for (const el of Array.from(bodyRoot.getElementsByTagName(tag))) {
      if (isInsideDateElement(el)) continue;
      const surface = buildSearchText(el.textContent ?? '', policy).text;
      if (surface.length === 0) continue;
      const mapKey = `${tag}\t${surface}`;
      if (!bySurfaceTag.has(mapKey)) bySurfaceTag.set(mapKey, { string: surface, tag });
    }
  }

  return [...bySurfaceTag.values()];
}

/**
 * Crawl several documents (e.g. every XML file in a project) and merge into
 * one dictionary, deduplicating by (surface, tag). Use this to tag the current
 * document from names already tagged anywhere in the project.
 */
export function crawlDocuments(
  docs: Document[],
  policy: WhitespacePolicy,
  tags: string[] = DEFAULT_CRAWL_TAGS,
): DictionaryEntry[] {
  const seen = new Map<string, DictionaryEntry>();
  for (const doc of docs) {
    for (const entry of crawlEntities(doc, policy, tags)) {
      seen.set(`${entry.tag}\t${entry.string}`, entry);
    }
  }
  return [...seen.values()];
}
