import { commitTagAttributes, readTagAttributes } from './attributeCommand';

const getWriter = () => window.writer;

const normalizedTagText = (element: Element): string => (element.textContent ?? '').trim();

export const listExactUnkeyedTagMatches = (tagElement: Element): Element[] => {
  const writer = getWriter();
  const body = writer?.editor?.getBody();
  const tagName = tagElement.getAttribute('_tag');
  const text = normalizedTagText(tagElement);
  if (!body || !tagName || !text) return [];

  const matches: Element[] = [];
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    const element = node as Element;
    if (element !== tagElement && element.getAttribute('_tag') === tagName) {
      const attrs = readTagAttributes(element);
      if (!attrs.key && normalizedTagText(element) === text) {
        matches.push(element);
      }
    }
    node = walker.nextNode();
  }

  return matches;
};

export const countExactUnkeyedTagMatches = (tagElement: Element): number =>
  listExactUnkeyedTagMatches(tagElement).length;

export const propagateAttributesToExactUnkeyedMatches = (
  sourceElement: Element,
): { applied: number; skipped: number } => {
  const writer = getWriter();
  const editor = writer?.editor;
  if (!editor) return { applied: 0, skipped: 0 };

  const attributes = readTagAttributes(sourceElement);
  if (!attributes.key) return { applied: 0, skipped: 0 };

  const matches = listExactUnkeyedTagMatches(sourceElement);
  let applied = 0;
  let skipped = 0;

  editor.undoManager.transact(() => {
    for (const match of matches) {
      const result = commitTagAttributes(match, attributes);
      if (result.applied) applied += 1;
      else skipped += 1;
    }
  });

  if (applied > 0) {
    writer?.event('contentChanged').publish();
  }

  return { applied, skipped };
};
