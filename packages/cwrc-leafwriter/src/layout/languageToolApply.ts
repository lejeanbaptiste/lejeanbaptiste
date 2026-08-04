/**
 * Apply a LanguageTool-style offset/length replacement across an element's
 * textContent by editing the underlying text nodes (preserves sibling markup).
 */
export const applyTextContentReplacement = (
  root: HTMLElement,
  offset: number,
  length: number,
  replacement: string,
): boolean => {
  if (offset < 0 || length < 0) return false;

  type Piece = { node: Text; start: number; end: number };
  const pieces: Piece[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const value = textNode.nodeValue ?? '';
    pieces.push({ node: textNode, start: cursor, end: cursor + value.length });
    cursor += value.length;
    node = walker.nextNode();
  }

  if (offset + length > cursor) return false;

  const endOffset = offset + length;
  const affected = pieces.filter((piece) => piece.end > offset && piece.start < endOffset);
  if (affected.length === 0) return false;

  // Single text node — simplest path.
  if (affected.length === 1) {
    const piece = affected[0]!;
    const localStart = offset - piece.start;
    const localEnd = endOffset - piece.start;
    const value = piece.node.nodeValue ?? '';
    piece.node.nodeValue = value.slice(0, localStart) + replacement + value.slice(localEnd);
    return true;
  }

  // Multi-node span: put the replacement in the first node; clear the rest of the range.
  const first = affected[0]!;
  const last = affected[affected.length - 1]!;
  const firstValue = first.node.nodeValue ?? '';
  const lastValue = last.node.nodeValue ?? '';
  const localStart = offset - first.start;
  const localEnd = endOffset - last.start;

  first.node.nodeValue = firstValue.slice(0, localStart) + replacement;
  for (let i = 1; i < affected.length - 1; i += 1) {
    affected[i]!.node.nodeValue = '';
  }
  last.node.nodeValue = lastValue.slice(localEnd);
  return true;
};

export interface LanguageToolMatchView {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId?: string;
}

/** Shift later matches after an earlier replacement. */
export const shiftLanguageToolMatchViews = (
  matches: LanguageToolMatchView[],
  appliedOffset: number,
  appliedLength: number,
  replacementLength: number,
): LanguageToolMatchView[] => {
  const delta = replacementLength - appliedLength;
  return matches
    .filter((match) => match.offset !== appliedOffset || match.length !== appliedLength)
    .map((match) => {
      if (match.offset >= appliedOffset + appliedLength) {
        return { ...match, offset: match.offset + delta };
      }
      if (
        match.offset + match.length > appliedOffset &&
        match.offset < appliedOffset + appliedLength
      ) {
        return null;
      }
      return match;
    })
    .filter((match): match is LanguageToolMatchView => match !== null);
};
