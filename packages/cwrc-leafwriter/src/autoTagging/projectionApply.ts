import { resolveXPath } from './anchor';
import { isInsideDateElement } from './dateTeiHelpers';
import { buildSearchText } from './normalize';
import { DEFAULT_PROJECTION_BRIDGE_TAGS } from './projectionIndex';
import type { Anchor, Suggestion, WhitespacePolicy } from './types';

export type ProjectionAddResolution =
  | {
      ok: true;
      parent: Element;
      startNode: Text;
      startOffset: number;
      endNode: Text;
      endOffset: number;
    }
  | {
      ok: false;
      outcome: 'unresolvable' | 'schema-blocked' | 'rule-blocked' | 'already-tagged';
      reason: string;
    };

const documentOrder = (a: Node, b: Node): number => {
  if (a === b) return 0;
  const pos = a.compareDocumentPosition(b);
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
};

const isEmptyBridgeElement = (el: Element): boolean => {
  if (!DEFAULT_PROJECTION_BRIDGE_TAGS.has(el.localName)) return false;
  const text = (el.textContent ?? '').replace(/\uFEFF/g, '').trim();
  return text.length === 0;
};

/**
 * Reconstruct the search-text surface for a sibling run from `startNode`/`startOffset`
 * through `endNode`/`endOffset` (half-open end), including bridged infrastructure.
 */
export function surfaceAlongSiblingRun(
  startNode: Text,
  startOffset: number,
  endNode: Text,
  endOffset: number,
  policy: WhitespacePolicy,
): string | null {
  if (startOffset < 0 || startOffset > startNode.data.length) return null;
  if (endOffset < 0 || endOffset > endNode.data.length) return null;
  if (documentOrder(startNode, endNode) > 0) return null;

  const parts: string[] = [];
  let current: ChildNode | null = startNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const text = current as Text;
      let raw = text.data;
      if (text === startNode && text === endNode) {
        raw = raw.slice(startOffset, endOffset);
      } else if (text === startNode) {
        raw = raw.slice(startOffset);
      } else if (text === endNode) {
        raw = raw.slice(0, endOffset);
      }
      parts.push(buildSearchText(raw, policy).text);
    } else if (current instanceof Element) {
      if (!isEmptyBridgeElement(current)) return null;
    } else {
      return null;
    }
    if (current === endNode) break;
    current = current.nextSibling;
  }
  if (current !== endNode) return null;
  return parts.join('');
}

/**
 * Resolve (without mutating) a cross-node `add` suggestion produced by the
 * projection matcher. The wrapped run must be a contiguous sibling sequence
 * of text nodes and empty infrastructure elements (`lb`, `pb`, …).
 */
export function resolveProjectionAdd(
  doc: Document,
  anchor: Anchor,
  policy: WhitespacePolicy,
): ProjectionAddResolution {
  if (!anchor.endXpath || anchor.endOffset === undefined) {
    return { ok: false, outcome: 'unresolvable', reason: 'anchor is missing its end boundary' };
  }

  const startNode = resolveXPath(doc, anchor.xpath);
  const endNode = resolveXPath(doc, anchor.endXpath);
  if (!startNode || !endNode) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'xpath no longer resolves for the projection span',
    };
  }

  if (startNode.parentNode !== endNode.parentNode) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'the projection span is no longer a contiguous sibling run',
    };
  }

  const parent = startNode.parentElement;
  if (!parent) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'projection span has no parent element',
    };
  }

  const surface = surfaceAlongSiblingRun(
    startNode,
    anchor.offset,
    endNode,
    anchor.endOffset,
    policy,
  );
  if (surface === null) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'the projection span no longer crosses only text and infrastructure nodes',
    };
  }
  if (surface !== anchor.surface) {
    return {
      ok: false,
      outcome: 'unresolvable',
      reason: 'the projection span text no longer matches the suggestion surface',
    };
  }

  return {
    ok: true,
    parent,
    startNode,
    startOffset: anchor.offset,
    endNode,
    endOffset: anchor.endOffset,
  };
}

/**
 * Wrap a contiguous sibling run from `(startNode, startOffset)` through
 * `(endNode, endOffset)` in a new element, preserving infrastructure nodes
 * (`lb`, `pb`, empty `anchor`, `gap`) inside the tag.
 */
export function wrapProjectionRange(
  doc: Document,
  startNode: Text,
  startOffset: number,
  endNode: Text,
  endOffset: number,
  suggestion: Suggestion,
): Element {
  if (startNode === endNode && startOffset < endOffset) {
    const target = startOffset > 0 ? startNode.splitText(startOffset) : startNode;
    const length = endOffset - startOffset;
    if (length < target.data.length) target.splitText(length);
    const element = doc.createElementNS(doc.documentElement?.namespaceURI ?? null, suggestion.tag);
    for (const [name, value] of Object.entries(suggestion.attributes ?? {})) {
      element.setAttribute(name, value);
    }
    target.parentNode!.insertBefore(element, target);
    element.appendChild(target);
    return element;
  }

  let spanStart: Text = startNode;
  if (startOffset > 0) {
    spanStart = startNode.splitText(startOffset);
  }

  const spanEnd: Text = endNode;
  if (endOffset < endNode.data.length) {
    endNode.splitText(endOffset);
  }

  const parent = spanStart.parentNode;
  if (!parent || spanEnd.parentNode !== parent) {
    throw new Error('wrapProjectionRange: boundaries are not siblings after splitting');
  }

  const element = doc.createElementNS(doc.documentElement?.namespaceURI ?? null, suggestion.tag);
  for (const [name, value] of Object.entries(suggestion.attributes ?? {})) {
    element.setAttribute(name, value);
  }

  parent.insertBefore(element, spanStart);
  let current: ChildNode | null = spanStart;
  while (current) {
    const next: ChildNode | null = current.nextSibling;
    element.appendChild(current);
    if (current === spanEnd) break;
    current = next;
  }

  return element;
}

export const projectionSpanIsInsideDate = (startNode: Text, endNode: Text): boolean =>
  isInsideDateElement(startNode) || isInsideDateElement(endNode);
