import { buildDocIndex, createAnchor } from './anchor';
import { MultiStringMatcher } from './matcher';
import type { Suggestion, WhitespacePolicy } from './types';

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

/**
 * Dictionary producer: scan the document for entry strings and emit tag-only
 * 'add' suggestions (no ids — identity is deferred to disambiguation).
 * Longest string first, leftmost-longest, never crossing tag boundaries.
 * Strings shorter than `minLength` (default 2 code points) are skipped —
 * single characters over-match in running text and are almost never entities.
 * Whole-document occurrence counting happens in createAnchor.
 */
export function dictionaryTag(
  doc: Document,
  entries: DictionaryEntry[],
  policy: WhitespacePolicy,
  sourceDetail = 'dictionary',
  minLength: number = DEFAULT_MIN_MATCH_LENGTH,
): Suggestion[] {
  // Map each surface string to its entry, dropping too-short strings. When the
  // same string carries several tags, the first entry in input order wins the
  // span (mirrors longest-first/stable-order); such collisions are rare.
  const entryByString = new Map<string, DictionaryEntry>();
  for (const entry of entries) {
    if ([...entry.string].length < minLength) continue;
    if (!entryByString.has(entry.string)) entryByString.set(entry.string, entry);
  }
  const matcher = new MultiStringMatcher(entryByString.keys());

  const index = buildDocIndex(doc, policy);
  const suggestions: Suggestion[] = [];
  let counter = 0;

  for (const { node, search } of index.nodes) {
    // Ancestor tag names for this node, computed once (not per match).
    const ancestors = ancestorTagNames(node);

    for (const match of matcher.scan(search.text)) {
      const entry = entryByString.get(match.pattern)!;
      // Skip spots already inside this tag — no point re-suggesting.
      if (ancestors.has(entry.tag)) continue;

      const rawStart = search.map[match.start]!;
      const rawEnd = search.map[match.end - 1]! + 1;
      suggestions.push({
        id: `dict_${counter++}`,
        source: 'dictionary',
        sourceDetail,
        action: 'add',
        tag: entry.tag,
        anchor: createAnchor('', doc, node, rawStart, rawEnd, policy, index),
        rationale: `Matched "${match.pattern}" (${sourceDetail})`,
        status: 'pending',
      });
    }
  }

  return suggestions;
}

/** The set of ancestor element names above a node (computed once per node). */
function ancestorTagNames(node: Node): Set<string> {
  const names = new Set<string>();
  for (let el = node.parentElement; el; el = el.parentElement) names.add(el.nodeName);
  return names;
}
