/**
 * Option/Alt (Mac) or Ctrl (Windows/Linux) + Left/Right: move the caret by
 * punctuation / whitespace boundaries, landing *before* the boundary.
 *
 * Designed for Chinese and other no-space scripts, where the browser's default
 * "word" jump is nearly useless. Spaces, line breaks, and any Unicode punctuation
 * (Chinese or Latin) all count as boundaries.
 */

/** TinyMCE empty-tag placeholders and soft hyphens — not real document text. */
const isInvisibleChar = (ch: string): boolean =>
  ch === '\uFEFF' || ch === '\u200B' || ch === '\u00AD';

/**
 * A boundary character: Unicode punctuation (`\p{P}`) or any whitespace
 * (ASCII space, newline, ideographic space U+3000, nbsp, etc.).
 */
export const isBoundaryChar = (ch: string): boolean => {
  if (!ch || isInvisibleChar(ch)) return false;
  return /\p{P}|\s/u.test(ch);
};

const isContentChar = (ch: string): boolean =>
  ch !== '' && !isInvisibleChar(ch) && !isBoundaryChar(ch);

export type BoundaryDirection = 'forward' | 'backward';

/** True when `offset` is the start of a punctuation/whitespace run. */
const isBoundaryRunStart = (text: string, offset: number): boolean => {
  if (offset < 0 || offset >= text.length || !isBoundaryChar(text[offset]!)) return false;
  if (offset === 0) return true;
  const prev = text[offset - 1]!;
  return isInvisibleChar(prev) || isContentChar(prev);
};

/**
 * Stop positions: start of document, start of each boundary run, end of document.
 * Consecutive punctuation/spaces count as one run (one stop, before the first mark).
 */
const boundaryStopOffsets = (text: string): number[] => {
  const stops = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (isBoundaryRunStart(text, i)) stops.push(i);
  }
  const n = text.length;
  if (stops[stops.length - 1] !== n) stops.push(n);
  return stops;
};

/**
 * Given a flat string and caret offset, return the offset *before* the next
 * (or previous) punctuation/whitespace boundary run.
 *
 * Forward: next boundary-run start after the caret (or end of string).
 * Backward: previous boundary-run start before the caret (or start of string).
 * If the caret is already on a stop, move to the next/previous one.
 */
export function findPunctuationBoundaryOffset(
  text: string,
  offset: number,
  direction: BoundaryDirection,
): number {
  const n = text.length;
  const i = Math.max(0, Math.min(offset, n));
  const stops = boundaryStopOffsets(text);

  if (direction === 'forward') {
    for (const stop of stops) {
      if (stop > i) return stop;
    }
    return n;
  }

  for (let s = stops.length - 1; s >= 0; s -= 1) {
    const stop = stops[s]!;
    if (stop < i) return stop;
  }
  return 0;
}

export type TextCaret = { node: Text; offset: number };

type MappedChunk = {
  /** Inclusive start index in the flattened string. */
  flatStart: number;
  /** Exclusive end index in the flattened string. */
  flatEnd: number;
  node: Text;
  /** True when this chunk is a virtual newline inserted at a block boundary. */
  virtual?: boolean;
};

const isBogusElement = (el: Element): boolean => el.getAttribute('data-mce-bogus') !== null;

/**
 * Collect visible text under `root` in document order, inserting a virtual `\n`
 * between text nodes that sit in different block ancestors (so Option+Arrow
 * treats paragraph breaks like line breaks).
 */
export function flattenEditorText(
  root: Node,
  isBlock: (node: Node) => boolean,
): { text: string; chunks: MappedChunk[] } {
  const chunks: MappedChunk[] = [];
  let text = '';
  let prevTextNode: Text | null = null;

  const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode() as Text | null;

  while (current) {
    let skip = false;
    let el: Element | null =
      current.parentElement ?? (current.parentNode as Element | null);
    while (el && el !== root) {
      if (isBogusElement(el)) {
        skip = true;
        break;
      }
      el = el.parentElement;
    }

    if (!skip && current.data.length > 0) {
      if (prevTextNode && crossesBlockBoundary(prevTextNode, current, root, isBlock)) {
        const flatStart = text.length;
        text += '\n';
        chunks.push({ flatStart, flatEnd: text.length, node: prevTextNode, virtual: true });
      }
      const flatStart = text.length;
      text += current.data;
      chunks.push({ flatStart, flatEnd: text.length, node: current });
      prevTextNode = current;
    }

    current = walker.nextNode() as Text | null;
  }

  return { text, chunks };
}

const blockAncestor = (
  node: Node,
  root: Node,
  isBlock: (node: Node) => boolean,
): Node | null => {
  let cur: Node | null = node;
  while (cur && cur !== root) {
    if (cur.nodeType === Node.ELEMENT_NODE && isBlock(cur)) return cur;
    cur = cur.parentNode;
  }
  return null;
};

const crossesBlockBoundary = (
  a: Node,
  b: Node,
  root: Node,
  isBlock: (node: Node) => boolean,
): boolean => {
  const blockA = blockAncestor(a, root, isBlock);
  const blockB = blockAncestor(b, root, isBlock);
  return blockA !== null && blockB !== null && blockA !== blockB;
};

/** Map a DOM text caret to an index in the flattened string. */
export function caretToFlatOffset(chunks: MappedChunk[], caret: TextCaret): number {
  for (const chunk of chunks) {
    if (chunk.virtual || chunk.node !== caret.node) continue;
    const local = Math.max(0, Math.min(caret.offset, chunk.node.data.length));
    return chunk.flatStart + local;
  }
  // Caret in a text node we skipped (bogus) — fall back to nearest chunk.
  return 0;
}

/** Map a flattened index back to a real text-node caret (skips virtual newlines). */
export function flatOffsetToCaret(chunks: MappedChunk[], flatOffset: number): TextCaret | null {
  if (chunks.length === 0) return null;

  for (const chunk of chunks) {
    if (chunk.virtual) continue;
    if (flatOffset <= chunk.flatEnd) {
      const local = Math.max(0, flatOffset - chunk.flatStart);
      return { node: chunk.node, offset: Math.min(local, chunk.node.data.length) };
    }
  }

  const last = [...chunks].reverse().find((c) => !c.virtual);
  if (!last) return null;
  return { node: last.node, offset: last.node.data.length };
}

/**
 * Resolve the browser selection's focus to a text caret inside `root`.
 * Element offsets are converted to the nearest text position.
 */
export function resolveTextCaret(root: Node, node: Node | null, offset: number): TextCaret | null {
  if (!node || !root.contains(node)) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    return { node: node as Text, offset };
  }

  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const child = el.childNodes[offset] ?? null;
    if (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        return { node: child as Text, offset: 0 };
      }
      const inner = doc.createTreeWalker(child, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
      if (inner) return { node: inner, offset: 0 };
    }
    // After last child — use last text inside element, or previous text in root.
    const lastInside = (() => {
      let n: Text | null = null;
      const w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let cur = w.nextNode() as Text | null;
      while (cur) {
        n = cur;
        cur = w.nextNode() as Text | null;
      }
      return n;
    })();
    if (lastInside) return { node: lastInside, offset: lastInside.data.length };
  }

  // Fallback: first text node in root.
  const first = walker.nextNode() as Text | null;
  return first ? { node: first, offset: 0 } : null;
}

export type MoveByBoundaryResult = {
  focus: TextCaret;
  /** Flat offsets, useful for tests / debugging. */
  fromFlat: number;
  toFlat: number;
};

/**
 * Compute the next caret position for punctuation-boundary navigation inside
 * an editor root.
 */
export function computePunctuationBoundaryMove(
  root: Node,
  focus: TextCaret,
  direction: BoundaryDirection,
  isBlock: (node: Node) => boolean,
): MoveByBoundaryResult | null {
  const { text, chunks } = flattenEditorText(root, isBlock);
  if (chunks.length === 0) return null;

  const fromFlat = caretToFlatOffset(chunks, focus);
  const toFlat = findPunctuationBoundaryOffset(text, fromFlat, direction);
  const next = flatOffsetToCaret(chunks, toFlat);
  if (!next) return null;

  return { focus: next, fromFlat, toFlat };
}

/**
 * Apply Option/Ctrl + Arrow movement on a live Selection.
 * When `extend` is true (Shift held), the anchor stays put and the focus moves.
 */
export function applyPunctuationBoundaryMove(
  root: Node,
  selection: Selection,
  direction: BoundaryDirection,
  extend: boolean,
  isBlock: (node: Node) => boolean,
): boolean {
  const focus = resolveTextCaret(root, selection.focusNode, selection.focusOffset);
  if (!focus) return false;

  const moved = computePunctuationBoundaryMove(root, focus, direction, isBlock);
  if (!moved) return false;
  if (
    moved.focus.node === focus.node &&
    moved.focus.offset === focus.offset &&
    moved.fromFlat === moved.toFlat
  ) {
    return false;
  }

  if (extend) {
    selection.setBaseAndExtent(
      selection.anchorNode ?? moved.focus.node,
      selection.anchorOffset,
      moved.focus.node,
      moved.focus.offset,
    );
  } else {
    selection.collapse(moved.focus.node, moved.focus.offset);
  }
  return true;
}

/** True when this keydown should run punctuation-boundary navigation. */
export function isPunctuationBoundaryNavEvent(event: KeyboardEvent, isMac: boolean): boolean {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return false;
  if (event.isComposing) return false;
  if (isMac) {
    return event.altKey && !event.metaKey && !event.ctrlKey;
  }
  return event.ctrlKey && !event.altKey && !event.metaKey;
}
