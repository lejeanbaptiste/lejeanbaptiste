import { buildSearchText, hashText, type SearchText } from './normalize';
import type { Anchor, ResolvedAnchor, WhitespacePolicy } from './types';

const CONTEXT_LENGTH = 12;

interface DocTextNode {
  node: Text;
  search: SearchText;
}

/**
 * Document-level search index: all text nodes in document order plus their
 * concatenated search text, so context can span node boundaries (a tagged
 * name is often a text node containing nothing but the name itself).
 */
export interface DocIndex {
  nodes: DocTextNode[];
  /** Concatenation of every node's search text, in document order. */
  text: string;
  /** nodeStart[i] = offset of nodes[i]'s search text within `text`. */
  nodeStart: number[];
}

/** All non-empty text nodes under root, in document order, with their search text. */
export function collectTextNodes(root: Node, policy: WhitespacePolicy): DocTextNode[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const result: DocTextNode[] = [];
  let node = walker.nextNode();
  while (node) {
    const search = buildSearchText((node as Text).data, policy);
    if (search.text.length > 0) result.push({ node: node as Text, search });
    node = walker.nextNode();
  }
  return result;
}

export function buildDocIndex(root: Node, policy: WhitespacePolicy): DocIndex {
  const nodes = collectTextNodes(root, policy);
  const nodeStart: number[] = [];
  let total = 0;
  for (const { search } of nodes) {
    nodeStart.push(total);
    total += search.text.length;
  }
  return { nodes, text: nodes.map((n) => n.search.text).join(''), nodeStart };
}

/** Structural path to a text node, e.g. /TEI/text/body/div[1]/p[3]/text()[1]. */
export function xpathForTextNode(node: Text): string {
  const steps: string[] = [];

  const textSiblings = node.parentNode
    ? Array.from(node.parentNode.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE)
    : [node];
  steps.unshift(`text()[${textSiblings.indexOf(node) + 1}]`);

  let el: Element | null = node.parentElement;
  while (el) {
    const parent: Element | null = el.parentElement;
    if (!parent) {
      steps.unshift(el.nodeName);
      break;
    }
    const sameName = Array.from(parent.children).filter((c) => c.nodeName === el!.nodeName);
    steps.unshift(sameName.length > 1 ? `${el.nodeName}[${sameName.indexOf(el) + 1}]` : el.nodeName);
    el = parent;
  }

  return `/${steps.join('/')}`;
}

/** Resolve a path produced by xpathForTextNode. Returns null if the path no longer exists. */
export function resolveXPath(doc: Document, xpath: string): Text | null {
  const steps = xpath.replace(/^\//, '').split('/');
  const textStep = steps.pop();
  if (!textStep) return null;

  let el: Element | null = null;
  for (const step of steps) {
    const match = /^([^[]+)(?:\[(\d+)\])?$/.exec(step);
    if (!match) return null;
    const [, name, index] = match;
    const candidates: Element[] = el
      ? Array.from(el.children).filter((c) => c.nodeName === name)
      : doc.documentElement?.nodeName === name
        ? [doc.documentElement]
        : [];
    el = candidates[index ? parseInt(index, 10) - 1 : 0] ?? null;
    if (!el) return null;
  }

  const textMatch = /^text\(\)\[(\d+)\]$/.exec(textStep);
  if (!textMatch || !el) return null;
  const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
  return (textNodes[parseInt(textMatch[1]!, 10) - 1] as Text | undefined) ?? null;
}

interface Occurrence {
  /** Index into DocIndex.nodes. */
  nodeIndex: number;
  /** Index of the match in that node's search text. */
  searchIndex: number;
}

/**
 * Occurrences of surface within single nodes, in document order. Matches
 * spanning node boundaries are excluded — insertion targets one text node.
 */
function occurrences(index: DocIndex, surface: string, nodeIndex?: number): Occurrence[] {
  const result: Occurrence[] = [];
  const scan = nodeIndex === undefined ? index.nodes.keys() : [nodeIndex];
  for (const i of scan) {
    const docNode = index.nodes[i];
    if (!docNode) continue;
    let from = 0;
    while (true) {
      const searchIndex = docNode.search.text.indexOf(surface, from);
      if (searchIndex === -1) break;
      result.push({ nodeIndex: i, searchIndex });
      from = searchIndex + 1;
    }
  }
  return result;
}

/** Raw start/end offsets in node.data for a match at searchIndex of the given length. */
function rawRange(search: SearchText, searchIndex: number, length: number) {
  return {
    start: search.map[searchIndex]!,
    end: search.map[searchIndex + length - 1]! + 1,
  };
}

/** Context around an occurrence, drawn from the document-level search text. */
function contextsAt(index: DocIndex, occ: Occurrence, surfaceLength: number) {
  const pos = index.nodeStart[occ.nodeIndex]! + occ.searchIndex;
  return {
    before: index.text.slice(Math.max(0, pos - CONTEXT_LENGTH), pos),
    after: index.text.slice(pos + surfaceLength, pos + surfaceLength + CONTEXT_LENGTH),
  };
}

/** Number of context chars agreeing with the anchor, counted outward from the match. */
function contextScore(index: DocIndex, anchor: Anchor, occ: Occurrence): number {
  const { before, after } = contextsAt(index, occ, anchor.surface.length);
  let score = 0;
  for (let i = 1; i <= Math.min(anchor.contextBefore.length, before.length); i++) {
    if (anchor.contextBefore[anchor.contextBefore.length - i] !== before[before.length - i]) break;
    score++;
  }
  for (let i = 0; i < Math.min(anchor.contextAfter.length, after.length); i++) {
    if (anchor.contextAfter[i] !== after[i]) break;
    score++;
  }
  return score;
}

/**
 * Create an anchor for the raw range [rawStart, rawEnd) inside a text node.
 * The document must already be NFC-normalized (see normalizeDomText).
 * Producers creating many anchors should pass a prebuilt DocIndex — it is
 * only valid while the document is unmodified.
 */
export function createAnchor(
  documentId: string,
  root: Node,
  node: Text,
  rawStart: number,
  rawEnd: number,
  policy: WhitespacePolicy,
  prebuiltIndex?: DocIndex,
): Anchor {
  const index = prebuiltIndex ?? buildDocIndex(root, policy);
  const nodeIndex = index.nodes.findIndex((n) => n.node === node);
  if (nodeIndex === -1) throw new Error('createAnchor: node is not under root or is empty');

  const { text, map } = index.nodes[nodeIndex]!.search;
  const searchStart = map.findIndex((raw) => raw >= rawStart);
  let searchEnd = searchStart;
  while (searchEnd < map.length && map[searchEnd]! < rawEnd) searchEnd++;
  if (searchStart === -1 || searchEnd === searchStart) {
    throw new Error('createAnchor: range contains no matchable characters');
  }

  const surface = text.slice(searchStart, searchEnd);
  const all = occurrences(index, surface);
  const occurrence =
    all.findIndex((o) => o.nodeIndex === nodeIndex && o.searchIndex === searchStart) + 1;
  if (occurrence === 0) throw new Error('createAnchor: could not locate own occurrence');

  const { before, after } = contextsAt(index, { nodeIndex, searchIndex: searchStart }, surface.length);

  return {
    documentId,
    xpath: xpathForTextNode(node),
    offset: map[searchStart]!,
    surface,
    occurrence,
    contextBefore: before,
    contextAfter: after,
    nodeHash: hashText(text),
  };
}

/**
 * Resolve an anchor against a (possibly edited) document, in tiers:
 * 1. XPath resolves and node hash matches → use stored offset.
 * 2. XPath resolves, hash differs → search within that node, context as tiebreaker.
 * 3. Whole-document search by occurrence index, context as tiebreaker.
 * Returns null when nothing verifies — the suggestion must then be marked unresolvable.
 */
export function resolveAnchor(
  doc: Document,
  anchor: Anchor,
  policy: WhitespacePolicy,
): ResolvedAnchor | null {
  const target = resolveXPath(doc, anchor.xpath);

  // Tier 1: unchanged node, verify surface at the stored offset.
  if (target) {
    const search = buildSearchText(target.data, policy);
    if (hashText(search.text) === anchor.nodeHash) {
      const searchIndex = search.map.indexOf(anchor.offset);
      if (searchIndex !== -1 && search.text.startsWith(anchor.surface, searchIndex)) {
        const { start, end } = rawRange(search, searchIndex, anchor.surface.length);
        return { node: target, start, end, tier: 1 };
      }
    }
  }

  const index = buildDocIndex(doc, policy);

  // Tier 2: node found but edited — search within it, context from the document stream.
  if (target) {
    const nodeIndex = index.nodes.findIndex((n) => n.node === target);
    if (nodeIndex !== -1) {
      const best = pickByContext(index, anchor, occurrences(index, anchor.surface, nodeIndex));
      if (best) return toResolved(index, best, anchor, 2);
    }
  }

  // Tier 3: whole-document search.
  const all = occurrences(index, anchor.surface);
  if (all.length === 0) return null;

  const byOccurrence = all[anchor.occurrence - 1];
  const chosen =
    byOccurrence && contextScore(index, anchor, byOccurrence) > 0
      ? byOccurrence
      : pickByContext(index, anchor, all);
  return chosen ? toResolved(index, chosen, anchor, 3) : null;
}

function toResolved(index: DocIndex, occ: Occurrence, anchor: Anchor, tier: 2 | 3): ResolvedAnchor {
  const docNode = index.nodes[occ.nodeIndex]!;
  const { start, end } = rawRange(docNode.search, occ.searchIndex, anchor.surface.length);
  return { node: docNode.node, start, end, tier };
}

/**
 * Pick the candidate whose context best matches the anchor. Requires a unique
 * winner with a positive score — even a lone candidate must show some context
 * agreement, since the xpath may have drifted onto the wrong node entirely.
 */
function pickByContext(index: DocIndex, anchor: Anchor, candidates: Occurrence[]): Occurrence | null {
  const scored = candidates.map((occ) => ({ occ, score: contextScore(index, anchor, occ) }));
  scored.sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  if (!first || first.score === 0) return null;
  if (second && second.score === first.score) return null;
  return first.occ;
}
