import { buildDocIndex, createAnchor } from './anchor';
import { isInsideDateElement } from './dates';
import { isWrappedByEntityTag } from './suggestionFilters';
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
 * When the same string carries several tags (e.g. a name that is both a
 * persName and a title), each match emits one suggestion per tag; the review
 * walk treats same-span alternatives as mutually exclusive.
 * Whole-document occurrence counting happens in createAnchor.
 */
export function dictionaryTag(
  doc: Document,
  entries: DictionaryEntry[],
  policy: WhitespacePolicy,
  sourceDetail = 'dictionary',
  minLength: number = DEFAULT_MIN_MATCH_LENGTH,
): Suggestion[] {
  // Map each surface string to its distinct tags (input order), dropping
  // too-short strings.
  const tagsByString = new Map<string, string[]>();
  for (const entry of entries) {
    if ([...entry.string].length < minLength) continue;
    const tags = tagsByString.get(entry.string);
    if (!tags) tagsByString.set(entry.string, [entry.tag]);
    else if (!tags.includes(entry.tag)) tags.push(entry.tag);
  }
  const matcher = new MultiStringMatcher(tagsByString.keys());

  const index = buildDocIndex(doc, policy);
  const suggestions: Suggestion[] = [];
  let counter = 0;

  for (const { node, search } of index.nodes) {
    // Never tag entity mentions inside <date> — reserved for sanmiao date workflow.
    if (isInsideDateElement(node)) continue;

    // Ancestor tag names for this node, computed once (not per match).
    const alreadyTagged = (tag: string) => isWrappedByEntityTag(node, tag);

    for (const match of matcher.scan(search.text)) {
      // Skip tags already wrapping this spot — no point re-suggesting.
      const tags = tagsByString.get(match.pattern)!.filter((tag) => !alreadyTagged(tag));
      if (tags.length === 0) continue;

      const rawStart = search.map[match.start]!;
      const rawEnd = search.map[match.end - 1]! + 1;
      const anchor = createAnchor('', doc, node, rawStart, rawEnd, policy, index);
      for (const tag of tags) {
        const others = tags.filter((t) => t !== tag);
        suggestions.push({
          id: `dict_${counter++}`,
          source: 'dictionary',
          sourceDetail,
          action: 'add',
          tag,
          anchor: { ...anchor },
          rationale:
            others.length > 0
              ? `Matched "${match.pattern}" (${sourceDetail}) — ambiguous: could also be ${others.map((t) => `<${t}>`).join(' or ')}`
              : `Matched "${match.pattern}" (${sourceDetail})`,
          status: 'pending',
        });
      }
    }
  }

  return suggestions;
}
