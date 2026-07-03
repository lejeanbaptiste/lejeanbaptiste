import { buildDocIndex, createAnchor } from './anchor';
import type { Suggestion, WhitespacePolicy } from './types';

/** One row of an imported dictionary table. */
export interface DictionaryEntry {
  string: string;
  tag: string;
  /** Optional attributes to set on the created element. */
  attributes?: Record<string, string>;
  /** Optional entity id (forward-compatible with Phase 3 disambiguation). */
  entityId?: string;
}

/**
 * Parse a CSV/TSV dictionary table. Expected columns: string, tag, and
 * optionally attributes (key=value pairs separated by ';') and entityId.
 * A header row naming the columns is recognized and used for ordering;
 * without one, column order is assumed to be string, tag, attributes, entityId.
 * Handles double-quoted fields (with "" escapes).
 */
export function parseDictionaryTable(content: string, delimiter?: ',' | '\t'): DictionaryEntry[] {
  const rows = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => splitRow(line, delimiter ?? (line.includes('\t') ? '\t' : ',')));
  return entriesFromRows(rows);
}

/**
 * Turn a grid of cells (from CSV, xlsx, or ods) into dictionary entries.
 * A header row naming the columns is recognized and used for ordering;
 * without one, column order is assumed to be string, tag, attributes, entityId.
 */
export function entriesFromRows(rows: string[][]): DictionaryEntry[] {
  if (rows.length === 0) return [];

  let columns = ['string', 'tag', 'attributes', 'entityId'];
  let dataRows = rows;
  const header = rows[0]!.map((c) => c.trim().toLowerCase());
  if (header.includes('string') && header.includes('tag')) {
    columns = header.map((h) => (h === 'entityid' ? 'entityId' : h));
    dataRows = rows.slice(1);
  }

  const entries: DictionaryEntry[] = [];
  for (const row of dataRows) {
    const get = (name: string) => {
      const i = columns.indexOf(name);
      return i === -1 ? undefined : row[i]?.trim() || undefined;
    };
    const string = get('string');
    const tag = get('tag');
    if (!string || !tag) continue;

    const entry: DictionaryEntry = { string, tag };
    const attributes = get('attributes');
    if (attributes) {
      entry.attributes = Object.fromEntries(
        attributes
          .split(';')
          .map((pair) => pair.split('=').map((s) => s.trim()))
          .filter((kv): kv is [string, string] => kv.length === 2 && !!kv[0] && !!kv[1]),
      );
    }
    const entityId = get('entityId');
    if (entityId) entry.entityId = entityId;
    entries.push(entry);
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

/**
 * Dictionary producer: scan the document for entry strings and emit 'add'
 * suggestions. Longest string first; within a text node, characters claimed
 * by a match are not available to later (shorter or overlapping) matches.
 * Matches never cross tag boundaries (matching is per text node by
 * construction). Whole-document occurrence counting happens in createAnchor.
 */
export function dictionaryTag(
  doc: Document,
  entries: DictionaryEntry[],
  policy: WhitespacePolicy,
  sourceDetail = 'dictionary',
): Suggestion[] {
  const sorted = [...entries].sort((a, b) => b.string.length - a.string.length);
  const suggestions: Suggestion[] = [];
  let counter = 0;

  const index = buildDocIndex(doc, policy);
  const nodes = index.nodes;
  const claimed = nodes.map(({ search }) => new Array<boolean>(search.text.length).fill(false));

  for (const entry of sorted) {
    nodes.forEach(({ node, search }, nodeIndex) => {
      // Skip nodes already inside this tag — no point suggesting what's
      // already tagged (also keeps the review list free of no-op items).
      if (hasAncestorTag(node, entry.tag)) return;

      let from = 0;
      while (true) {
        const idx = search.text.indexOf(entry.string, from);
        if (idx === -1) break;
        from = idx + 1;

        const range = claimed[nodeIndex]!.slice(idx, idx + entry.string.length);
        if (range.some(Boolean)) continue; // overlaps a longer, earlier match

        for (let i = idx; i < idx + entry.string.length; i++) claimed[nodeIndex]![i] = true;

        const rawStart = search.map[idx]!;
        const rawEnd = search.map[idx + entry.string.length - 1]! + 1;
        const attributes = {
          ...entry.attributes,
          ...(entry.entityId ? { key: entry.entityId } : {}),
        };
        suggestions.push({
          id: `dict_${counter++}`,
          source: 'dictionary',
          sourceDetail,
          action: 'add',
          tag: entry.tag,
          ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
          anchor: createAnchor('', doc, node, rawStart, rawEnd, policy, index),
          rationale: `Matched "${entry.string}" (${sourceDetail})`,
          status: 'pending',
        });
      }
    });
  }

  return suggestions;
}

/** True if the node has an ancestor element with the given tag name. */
function hasAncestorTag(node: Node, tag: string): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.nodeName === tag) return true;
  }
  return false;
}
