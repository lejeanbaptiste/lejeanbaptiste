export interface TextRangeRect {
  top: number;
  left: number;
  width: number;
  height: number;
  matchIndex: number;
}

/**
 * Map plain-text offsets to client rects relative to `root` for overlay underlines.
 */
export const collectMatchOverlayRects = (
  root: HTMLElement,
  matches: Array<{ offset: number; length: number }>,
): TextRangeRect[] => {
  const rootRect = root.getBoundingClientRect();
  const pieces: { node: Text; start: number; end: number }[] = [];
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

  const out: TextRangeRect[] = [];

  matches.forEach((match, matchIndex) => {
    if (match.length <= 0 || match.offset < 0 || match.offset + match.length > cursor) return;

    const range = document.createRange();
    let startSet = false;
    let endSet = false;

    for (const piece of pieces) {
      if (!startSet && match.offset >= piece.start && match.offset <= piece.end) {
        range.setStart(piece.node, match.offset - piece.start);
        startSet = true;
      }
      const end = match.offset + match.length;
      if (!endSet && end >= piece.start && end <= piece.end) {
        range.setEnd(piece.node, end - piece.start);
        endSet = true;
        break;
      }
    }

    if (!startSet || !endSet) return;

    const rects = Array.from(range.getClientRects());
    for (const rect of rects) {
      if (rect.width < 1 || rect.height < 1) continue;
      out.push({
        matchIndex,
        top: rect.bottom - rootRect.top + root.scrollTop - 3,
        left: rect.left - rootRect.left + root.scrollLeft,
        width: rect.width,
        height: 3,
      });
    }
  });

  return out;
};
