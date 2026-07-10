import { buildDocIndex, type DocIndex } from './anchor';
import type { SearchTextRange } from './chunk';
import type { WhitespacePolicy } from './types';

/**
 * The search text covered by a DOM range, from an index built over the same
 * root. Partial coverage of the boundary text nodes is respected; text nodes
 * fully inside the range contribute their whole search text.
 */
export function searchTextForDomRange(index: DocIndex, range: Range): string {
  if (range.collapsed) return '';
  let out = '';
  for (const { node, search } of index.nodes) {
    if (!range.intersectsNode(node)) continue;
    let from = 0;
    let to = search.text.length;
    // search.map[i] = raw offset in node.data of search char i.
    if (node === range.startContainer) {
      from = search.map.filter((raw) => raw < range.startOffset).length;
    }
    if (node === range.endContainer) {
      to = search.map.filter((raw) => raw < range.endOffset).length;
    }
    out += search.text.slice(from, to);
  }
  return out;
}

/**
 * Locate the selected editor text inside a parsed document's search text.
 * Producers and the editor body render the same text content, so a string
 * match sidesteps any offset-space differences between the two DOMs (the
 * same equivalence `AutoTaggingSession.focus()` relies on, in reverse).
 * Returns null when the selection is empty or cannot be found — callers then
 * fall back to the whole document.
 */
export function findSelectionRangeInDocument(
  doc: Document,
  selectedSearchText: string,
  policy: WhitespacePolicy,
): SearchTextRange | null {
  if (selectedSearchText.length === 0) return null;
  const index = buildDocIndex(doc, policy);
  // Multi-paragraph selections are effectively unique; if the string does
  // repeat, the first match still scopes to blocks with the same content.
  const start = index.text.indexOf(selectedSearchText);
  if (start === -1) return null;
  return { start, end: start + selectedSearchText.length };
}
