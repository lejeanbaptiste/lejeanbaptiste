import { parseTeiXPathSegments, matchesTeiTag } from './teiXPathWalker';

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

/** Build a TEI-style xpath from an editor element using _tag attributes. */
export const getTeiXPathFromEditorElement = (
  element: Element,
  body: HTMLElement,
): string => {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== body) {
    const tag = current.getAttribute('_tag');
    if (!tag) break;

    const parent = current.parentElement;
    if (!parent) break;

    const siblings = Array.from(parent.children).filter(
      (el): el is Element =>
        el.nodeType === Node.ELEMENT_NODE && matchesTeiTag(el.getAttribute('_tag'), tag),
    );
    const index = siblings.indexOf(current);
    const segment = index >= 0 ? `${tag}[${index + 1}]` : tag;
    segments.unshift(segment);
    current = parent;
  }

  return `/${segments.join('/')}`;
};

const normalizePathKey = (xpath: string) =>
  parseTeiXPathSegments(xpath)
    .map((segment) => `${segment.tag}[${segment.index + 1}]`)
    .join('/');

/** Find editor node by matching TEI xpath built from editor DOM against stored xpath. */
export const findEditorNodeByMatchingTeiXPath = (
  body: HTMLElement,
  storedXpath: string,
  query: string,
): Element | null => {
  if (!window.writer?.utilities || !query.trim()) return null;

  const nodes = window.writer.utilities.evaluateXPathAll(body, query.trim());
  const storedKey = normalizePathKey(storedXpath);

  for (const node of nodes) {
    if (!isElement(node)) continue;
    const editorXpath = getTeiXPathFromEditorElement(node, body);
    if (editorXpath === storedXpath || normalizePathKey(editorXpath) === storedKey) {
      return node;
    }
  }

  return null;
};
