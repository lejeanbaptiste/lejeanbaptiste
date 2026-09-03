import { buildDocIndex, createAnchor } from './anchor';
import { isInsideDateElement, isInsideTeiHeader } from './dateTeiHelpers';
import {
  buildProjectionIndex,
  createAnchorFromProjection,
  type ProjectionIndex,
} from './projectionIndex';
import { isWrappedByEntityTag } from './suggestionFilters';
import { MultiStringMatcher } from './matcher';
import { hasTibetan, isTibetanEdgeChar, normalizeMatchPattern } from './normalize';
import type { Suggestion, WhitespacePolicy } from './types';

/**
 * Reject a match that begins or ends inside a Tibetan syllable. Tibetan is
 * written with no word spacing, so a bare substring matcher will otherwise tag
 * "རྒྱ" inside "རྒྱལ". A real full-name match is always flanked by a tsheg, a
 * shad, whitespace, a string edge, or the a-chung that starts a fused particle
 * (see `isTibetanEdgeChar`). Non-Tibetan patterns are unaffected.
 */
const tibetanEdgesOk = (text: string, start: number, end: number, pattern: string): boolean =>
  !hasTibetan(pattern) || (isTibetanEdgeChar(text[start - 1]) && isTibetanEdgeChar(text[end]));

/**
 * One row of an imported table. Tag-stage only: a string and the tag to wrap
 * it in. NO ids/attributes — all identity work is deferred to disambiguation
 * (Phase 4b), so extra columns (entity ids, etc.) in an imported file are
 * ignored here and kept clean out of the document.
 */
export interface DictionaryEntry {
  string: string;
  tag: string;
}

/**
 * Parse a CSV/TSV table into {string, tag} entries. A header row naming the
 * columns is recognized; without one, the first two columns are string, tag.
 * Any other columns (ids, metadata) are ignored at this stage. Handles
 * double-quoted fields (with "" escapes).
 */
export function parseDictionaryTable(content: string, delimiter?: ',' | '\t'): DictionaryEntry[] {
  const rows = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => splitRow(line, delimiter ?? (line.includes('\t') ? '\t' : ',')));
  return entriesFromRows(rows);
}

/**
 * Turn a grid of cells (from CSV, xlsx, or ods) into {string, tag} entries.
 * A header naming `string`/`tag` columns is honored; otherwise the first two
 * columns are used. Extra columns are ignored — the tag stage inserts no ids.
 */
export function entriesFromRows(rows: string[][]): DictionaryEntry[] {
  if (rows.length === 0) return [];

  let stringCol = 0;
  let tagCol = 1;
  let dataRows = rows;
  const header = rows[0]!.map((c) => c.trim().toLowerCase());
  if (header.includes('string') && header.includes('tag')) {
    stringCol = header.indexOf('string');
    tagCol = header.indexOf('tag');
    dataRows = rows.slice(1);
  }

  const entries: DictionaryEntry[] = [];
  for (const row of dataRows) {
    const string = row[stringCol]?.trim();
    const tag = row[tagCol]?.trim();
    if (!string || !tag) continue;
    entries.push({ string, tag });
  }
  return entries;
}

function splitRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"' && current === '') {
      quoted = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Default minimum surface length: single characters match far too broadly. */
export const DEFAULT_MIN_MATCH_LENGTH = 2;

const buildTagsByString = (
  entries: DictionaryEntry[],
  minLength: number,
): Map<string, string[]> => {
  const tagsByString = new Map<string, string[]>();
  for (const entry of entries) {
    // Normalize the pattern the same way the document search text is normalized
    // (NFC everywhere; for Tibetan also fold the non-breaking tsheg and drop a
    // terminal tsheg/shad) so an authority headword like "བཀྲ་ཤིས།" matches the
    // running-text form "བཀྲ་ཤིས". Length-gate the normalized form.
    const pattern = normalizeMatchPattern(entry.string);
    if ([...pattern].length < minLength) continue;
    const tags = tagsByString.get(pattern);
    if (!tags) tagsByString.set(pattern, [entry.tag]);
    else if (!tags.includes(entry.tag)) tags.push(entry.tag);
  }
  return tagsByString;
};

const suggestionRationale = (
  pattern: string,
  sourceDetail: string,
  tag: string,
  allTags: string[],
): string => {
  const others = allTags.filter((t) => t !== tag);
  return others.length > 0
    ? `Matched "${pattern}" (${sourceDetail}) — ambiguous: could also be ${others.map((t) => `<${t}>`).join(' or ')}`
    : `Matched "${pattern}" (${sourceDetail})`;
};

/**
 * Dictionary producer: scan the document for entry strings and emit tag-only
 * 'add' suggestions (no ids — identity is deferred to disambiguation).
 * Longest string first, leftmost-longest, never crossing tag boundaries.
 * Whole-document occurrence counting happens in createAnchor.
 */
export function dictionaryTag(
  doc: Document,
  entries: DictionaryEntry[],
  policy: WhitespacePolicy,
  sourceDetail = 'dictionary',
  minLength: number = DEFAULT_MIN_MATCH_LENGTH,
): Suggestion[] {
  const tagsByString = buildTagsByString(entries, minLength);
  if (tagsByString.size === 0) return [];

  const matcher = new MultiStringMatcher(tagsByString.keys());
  const index = buildDocIndex(doc, policy);
  const suggestions: Suggestion[] = [];
  let counter = 0;

  for (const { node, search } of index.nodes) {
    if (isInsideDateElement(node) || isInsideTeiHeader(node)) continue;

    const alreadyTagged = (tag: string) => isWrappedByEntityTag(node, tag);

    for (const match of matcher.scan(search.text)) {
      if (!tibetanEdgesOk(search.text, match.start, match.end, match.pattern)) continue;
      const tags = tagsByString.get(match.pattern)!.filter((tag) => !alreadyTagged(tag));
      if (tags.length === 0) continue;

      const rawStart = search.map[match.start]!;
      const rawEnd = search.map[match.end - 1]! + 1;
      const anchor = createAnchor('', doc, node, rawStart, rawEnd, policy, index);
      for (const tag of tags) {
        suggestions.push({
          id: `dict_${counter++}`,
          source: 'dictionary',
          sourceDetail,
          action: 'add',
          tag,
          anchor: { ...anchor },
          rationale: suggestionRationale(match.pattern, sourceDetail, tag, tags),
          status: 'pending',
        });
      }
    }
  }

  return suggestions;
}

/**
 * Milestone-aware dictionary producer (Phase B): one scan of
 * {@link buildProjectionIndex} text instead of per text-node scans. Cross-node
 * spans set `anchor.endXpath` / `anchor.endOffset` for Phase C wrap apply.
 * Not used in production until `useProjectionMatcher` is enabled on the tag bomb.
 */
export function dictionaryTagProjection(
  doc: Document,
  entries: DictionaryEntry[],
  policy: WhitespacePolicy,
  sourceDetail = 'dictionary',
  minLength: number = DEFAULT_MIN_MATCH_LENGTH,
  prebuiltProjection?: ProjectionIndex,
): Suggestion[] {
  const tagsByString = buildTagsByString(entries, minLength);
  if (tagsByString.size === 0) return [];

  const matcher = new MultiStringMatcher(tagsByString.keys());
  const projection = prebuiltProjection ?? buildProjectionIndex(doc, policy);
  const docIndex = buildDocIndex(doc, policy);
  const suggestions: Suggestion[] = [];
  let counter = 0;

  for (const match of matcher.scan(projection.text)) {
    if (!tibetanEdgesOk(projection.text, match.start, match.end, match.pattern)) continue;
    const length = match.end - match.start;
    const startNode = projection.points[match.start]?.node;
    if (!startNode) continue;
    if (isInsideDateElement(startNode) || isInsideTeiHeader(startNode)) continue;

    const tags = tagsByString
      .get(match.pattern)!
      .filter((tag) => !isWrappedByEntityTag(startNode, tag));
    if (tags.length === 0) continue;

    const anchor = createAnchorFromProjection(
      doc,
      projection,
      match.start,
      length,
      match.pattern,
      policy,
      docIndex,
    );

    for (const tag of tags) {
      suggestions.push({
        id: `dict_${counter++}`,
        source: 'dictionary',
        sourceDetail,
        action: 'add',
        tag,
        anchor: { ...anchor },
        rationale: suggestionRationale(match.pattern, sourceDetail, tag, tags),
        status: 'pending',
      });
    }
  }

  return suggestions;
}
