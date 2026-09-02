import { buildSearchText } from './normalize';
import { isInsideDateElement, isInsideTeiHeader } from './dateTeiHelpers';
import type { WhitespacePolicy } from './types';

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
 * Not wired into the tag bomb yet — Phase A read path only.
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

  walkProjection(root, policy, bridgeTags, textParts, points, infrastructure);

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
