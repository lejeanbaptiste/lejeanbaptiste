import type { WhitespacePolicy } from './types';

/**
 * Search text derived from a raw string, with a map from each search-text
 * index back to the raw offset it came from.
 */
export interface SearchText {
  text: string;
  /** map[i] = offset in the raw string of search-text char i. Length === text.length. */
  map: number[];
}

const isWhitespace = (char: string) => /\s/.test(char);

/**
 * Characters with no visible extent that must never take part in matching:
 * zero-width space, the joiners and the soft hyphen. Editors and pasted text
 * seed these into text nodes (TinyMCE's own U+FEFF markers are already
 * covered — JavaScript counts that one as whitespace), and a search text that
 * kept them would stop matching anchors built from the serialized XML.
 */
const isInvisible = (char: string) =>
  char === '\uFEFF' ||
  char === '\u200B' ||
  char === '\u200C' ||
  char === '\u200D' ||
  char === '\u00AD';

/**
 * NFC-normalize every text node under root, in place. This is the single
 * central normalization point: anchors are created and resolved against
 * NFC text, and nothing downstream normalizes independently.
 */
export function normalizeDomText(root: Node): void {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const nfc = text.data.normalize('NFC');
    if (nfc !== text.data) text.data = nfc;
    node = walker.nextNode();
  }
}

/**
 * Build search text from a raw (already NFC) string under the given
 * whitespace policy, keeping a map back to raw offsets.
 */
export function buildSearchText(raw: string, policy: WhitespacePolicy): SearchText {
  const chars: string[] = [];
  const map: number[] = [];
  let pendingSpace = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;
    if (isInvisible(char)) continue;
    if (isWhitespace(char)) {
      if (policy === 'collapse') pendingSpace = true;
      continue;
    }
    if (pendingSpace && chars.length > 0) {
      chars.push(' ');
      map.push(map[map.length - 1]! + 1);
    }
    pendingSpace = false;
    chars.push(char);
    map.push(i);
  }

  return { text: chars.join(''), map };
}

/** FNV-1a 32-bit hash, hex-encoded. Used to detect stale anchors, not for security. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
