import { buildSearchText, hashText } from './normalize';
import { isInsideDateElement, isInsideTeiHeader } from './dateTeiHelpers';
import { createAnchor, xpathForTextNode, type DocIndex } from './anchor';
import type { Anchor, WhitespacePolicy } from './types';

/** Empty milestones bridged in projection text (match spans may include them on apply). */
export const DEFAULT_PROJECTION_BRIDGE_TAGS = new Set(['lb', 'pb', 'anchor', 'gap']);

/** Text under these elements is excluded from projection (corr-only reading). */
export const PROJECTION_HIDDEN_READING_TAGS = new Set(['sic', 'surplus']);

export interface ProjectionTextPoint {
  node: Text;
  /** Offset in `node.data` (NFC raw text) for this projection character. */
  rawOffset: number;
}

export interface ProjectionInfrastructureMark {
  element: Element;
  tag: string;
  /** Infrastructure sits after this many characters of {@link ProjectionIndex.text}. */
  afterOffset: number;
}

export interface ProjectionIndexOptions {
  bridgeTags?: ReadonlySet<string>;
}

/**
 * Flat search string for milestone-aware auto-tagging, plus a per-character map
 * back to DOM text nodes. Empty {@link DEFAULT_PROJECTION_BRIDGE_TAGS} elements
 * contribute no characters but are recorded in {@link ProjectionIndex.infrastructure}
 * for a future wrap apply (Phase C).
 *
 * Phase B–C: {@link createAnchorFromProjection}, {@link dictionaryTagProjection}, and
 * {@link wrapProjectionRange} consume this index; production tag bomb still defaults to
 * per-node matching until `useProjectionMatcher` is enabled.
 */
export interface ProjectionIndex {
  text: string;
  points: ProjectionTextPoint[];
  infrastructure: ProjectionInfrastructureMark[];
}

const isHiddenReadingText = (node: Text): boolean => {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (PROJECTION_HIDDEN_READING_TAGS.has(el.localName)) return true;
  }
  return false;
};

const isEmptyBridgeElement = (el: Element, bridgeTags: ReadonlySet<string>): boolean => {
  if (!bridgeTags.has(el.localName)) return false;
  const text = (el.textContent ?? '').replace(/\uFEFF/g, '').trim();
  return text.length === 0;
};

const appendSearchText = (
  node: Text,
  policy: WhitespacePolicy,
  textParts: string[],
  points: ProjectionTextPoint[],
): void => {
  const search = buildSearchText(node.data, policy);
  for (let i = 0; i < search.text.length; i++) {
    textParts.push(search.text[i]!);
    points.push({ node, rawOffset: search.map[i]! });
  }
};

const walkProjection = (
  node: Node,
  policy: WhitespacePolicy,
  bridgeTags: ReadonlySet<string>,
  textParts: string[],
  points: ProjectionTextPoint[],
  infrastructure: ProjectionInfrastructureMark[],
): void => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    if (isInsideTeiHeader(text) || isInsideDateElement(text) || isHiddenReadingText(text)) return;
    appendSearchText(text, policy, textParts, points);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;

  if (el.localName === 'teiHeader') return;

  if (isEmptyBridgeElement(el, bridgeTags)) {
    infrastructure.push({
      element: el,
      tag: el.localName,
      afterOffset: textParts.length,
    });
    return;
  }

  for (const child of el.childNodes) {
    walkProjection(child, policy, bridgeTags, textParts, points, infrastructure);
  }
};

export function buildProjectionIndex(
  root: Node,
  policy: WhitespacePolicy,
  options: ProjectionIndexOptions = {},
): ProjectionIndex {
  const bridgeTags = options.bridgeTags ?? DEFAULT_PROJECTION_BRIDGE_TAGS;
  const textParts: string[] = [];
  const points: ProjectionTextPoint[] = [];
  const infrastructure: ProjectionInfrastructureMark[] = [];

  const walkRoot =
    root.nodeType === Node.DOCUMENT_NODE ? (root as Document).documentElement : root;
  if (!walkRoot) {
    return { text: '', points: [], infrastructure: [] };
  }

  walkProjection(walkRoot, policy, bridgeTags, textParts, points, infrastructure);

  return {
    text: textParts.join(''),
    points,
    infrastructure,
  };
}

/** Infrastructure marks strictly inside `(startOffset, endOffset)` on projection text. */
export function infrastructureInProjectionRange(
  index: ProjectionIndex,
  startOffset: number,
  endOffset: number,
): ProjectionInfrastructureMark[] {
  return index.infrastructure.filter(
    (mark) => mark.afterOffset > startOffset && mark.afterOffset < endOffset,
  );
}

const PROJECTION_CONTEXT_LENGTH = 12;

/** Raw text-node bounds for a half-open range `[startOffset, startOffset + length)` on projection text. */
export function projectionRangeToRawBounds(
  projection: ProjectionIndex,
  startOffset: number,
  length: number,
): {
  startNode: Text;
  startRaw: number;
  endNode: Text;
  endRaw: number;
} {
  if (length <= 0 || startOffset < 0 || startOffset + length > projection.text.length) {
    throw new Error('projectionRangeToRawBounds: invalid range');
  }
  const startPoint = projection.points[startOffset]!;
  const endPoint = projection.points[startOffset + length - 1]!;
  return {
    startNode: startPoint.node,
    startRaw: startPoint.rawOffset,
    endNode: endPoint.node,
    endRaw: endPoint.rawOffset + 1,
  };
}

const occurrenceInProjectionText = (
  projection: ProjectionIndex,
  surface: string,
  flatStart: number,
): number => {
  let seen = 0;
  let from = 0;
  while (true) {
    const at = projection.text.indexOf(surface, from);
    if (at < 0) return 0;
    seen++;
    if (at === flatStart) return seen;
    from = at + 1;
  }
};

/**
 * Build an {@link Anchor} for a match on {@link ProjectionIndex.text}. Single-node
 * spans delegate to {@link createAnchor} for parity with `dictionaryTag`; cross-node
 * spans (milestones, corr-only choice text) set `endXpath` / `endOffset` for Phase C apply.
 */
export function createAnchorFromProjection(
  root: Node,
  projection: ProjectionIndex,
  startOffset: number,
  length: number,
  surface: string,
  policy: WhitespacePolicy,
  prebuiltDocIndex?: DocIndex,
): Anchor {
  const { startNode, startRaw, endNode, endRaw } = projectionRangeToRawBounds(
    projection,
    startOffset,
    length,
  );

  if (startNode === endNode) {
    return createAnchor('', root, startNode, startRaw, endRaw, policy, prebuiltDocIndex);
  }

  const occurrence = occurrenceInProjectionText(projection, surface, startOffset);
  if (!occurrence) {
    throw new Error('createAnchorFromProjection: surface does not match projection range');
  }

  const startSearch = buildSearchText(startNode.data, policy);
  return {
    documentId: '',
    xpath: xpathForTextNode(startNode),
    offset: startRaw,
    surface,
    occurrence,
    contextBefore: projection.text.slice(
      Math.max(0, startOffset - PROJECTION_CONTEXT_LENGTH),
      startOffset,
    ),
    contextAfter: projection.text.slice(
      startOffset + length,
      startOffset + length + PROJECTION_CONTEXT_LENGTH,
    ),
    nodeHash: hashText(startSearch.text),
    endXpath: xpathForTextNode(endNode),
    endOffset: endRaw,
  };
}

export const projectionSpanCrossesInfrastructure = (
  projection: ProjectionIndex,
  startOffset: number,
  length: number,
): boolean => infrastructureInProjectionRange(projection, startOffset, startOffset + length).length > 0;
