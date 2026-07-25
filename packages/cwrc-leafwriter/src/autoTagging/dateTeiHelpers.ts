import { collectTextNodes, type DocIndex } from './anchor';
import type { WhitespacePolicy } from './types';

/** Prefer TEI `<text><body>` over header/front matter. */
export function findTeiBodyRoot(doc: Document): Node {
  const root = doc.documentElement;
  if (!root) return doc;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (node.localName === 'body' && hasAncestorLocalName(node, 'text')) return node;
    node = walker.nextNode() as Element | null;
  }
  return root;
}

function hasAncestorLocalName(node: Element, name: string): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.localName === name) return true;
  }
  return false;
}

/** TEI entity tags that must not be inserted inside `<date>`. */
export const ENTITY_TAGS_FORBIDDEN_IN_DATE = [
  'persName',
  'placeName',
  'orgName',
  'org',
  'geogName',
  'name',
  'roleName',
  'title',
] as const;

function hasDateAncestor(node: Node): boolean {
  let el: Element | null =
    node.nodeType === Node.TEXT_NODE
      ? (node as Text).parentElement
      : node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
  for (; el; el = el.parentElement) {
    if (el.localName === 'date') return true;
  }
  return false;
}

/** True when `node` sits inside a TEI `<date>` (including subelements like when/orig). */
export function isInsideDateElement(node: Node): boolean {
  return hasDateAncestor(node);
}

export function isEntityTagForbiddenInDate(tag: string): boolean {
  return (ENTITY_TAGS_FORBIDDEN_IN_DATE as readonly string[]).includes(tag);
}

/** Document index excluding text already inside `<date>` elements. */
export function buildTaggableDocIndex(root: Node, policy: WhitespacePolicy): DocIndex {
  const all = collectTextNodes(root, policy);
  const nodes = all.filter(({ node }) => !isInsideDateElement(node));
  const nodeStart: number[] = [];
  let total = 0;
  for (const { search } of nodes) {
    nodeStart.push(total);
    total += search.text.length;
  }
  return { nodes, text: nodes.map((n) => n.search.text).join(''), nodeStart };
}
