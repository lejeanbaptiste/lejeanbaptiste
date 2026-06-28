import type Writer from '../Writer';

export const PARAGRAPH_TAG = 'p';

const PARAGRAPH_BREAK = /(?:<br\s*\/?>\s*){2,}/gi;

export type NormalizePastedParagraphsDeps = {
  getUniqueId: (prefix: string) => string;
  isParagraphValidInParent: (parentTag: string) => boolean;
  paragraphCanContainText: boolean;
  blockTag: string;
  insertionParentTag: string | null;
};

const isUntaggedBlock = (element: Element, blockTag: string) => {
  if (element.hasAttribute('_tag')) return false;
  const name = element.nodeName.toLowerCase();
  return name === blockTag || name === 'p';
};

const findStructuralParent = (start: Element | null, stopBefore: Element | null): Element | null => {
  let current = start;
  while (current && current !== stopBefore) {
    if (current.hasAttribute('_tag')) return current;
    current = current.parentElement;
  }
  return null;
};

const getStructuralParentTag = (element: Element, root: Element): string | null => {
  const stopBefore = root.parentElement;
  const parent = findStructuralParent(element.parentElement, stopBefore);
  return parent?.getAttribute('_tag') ?? null;
};

export const getEffectiveParentTag = ({
  element,
  root,
  insertionParentTag,
}: {
  element: Element;
  root: Element;
  insertionParentTag: string | null;
}): string | null => {
  const fromFragment = getStructuralParentTag(element, root);
  if (fromFragment) return fromFragment;

  if (insertionParentTag === PARAGRAPH_TAG) {
    // Pasting into a paragraph creates sibling <p> elements under the paragraph's parent.
    return insertionParentTag;
  }

  return insertionParentTag;
};

export const canTagAsParagraph = (
  parentTag: string | null,
  isParagraphValidInParent: (parentTag: string) => boolean,
): boolean => {
  if (!parentTag) return false;
  if (parentTag === PARAGRAPH_TAG) return true;
  return isParagraphValidInParent(parentTag);
};

export const isEffectivelyEmptyParagraph = (element: Element): boolean => {
  if (element.querySelector('img, [_entity]')) return false;

  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('br[data-mce-bogus], span[data-mce-bogus]').forEach((node) => {
    node.remove();
  });

  const text =
    clone.textContent
      ?.replace(/\uFEFF/g, '')
      .replace(/\u00A0/g, ' ')
      .trim() ?? '';

  return text.length === 0;
};

export const removeEmptyParagraphs = (root: ParentNode, blockTag = 'div') => {
  const tagged = Array.from(root.querySelectorAll(`[_tag="${PARAGRAPH_TAG}"]`));
  for (const paragraph of tagged) {
    if (isEffectivelyEmptyParagraph(paragraph)) {
      paragraph.remove();
    }
  }

  const untagged = Array.from(
    root.querySelectorAll(`${blockTag}:not([_tag]), p:not([_tag])`),
  );
  for (const block of untagged) {
    if (isEffectivelyEmptyParagraph(block)) {
      block.remove();
    }
  }
};

const splitDivOnParagraphBreaks = (element: HTMLDivElement, blockTag: string): HTMLDivElement[] => {
  const html = element.innerHTML;
  if (!PARAGRAPH_BREAK.test(html)) {
    PARAGRAPH_BREAK.lastIndex = 0;
    return [element];
  }
  PARAGRAPH_BREAK.lastIndex = 0;

  const parts = html
    .split(PARAGRAPH_BREAK)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length <= 1) return [element];

  const doc = element.ownerDocument;
  const parent = element.parentNode;
  if (!doc || !parent) return [element];

  const replacements: HTMLDivElement[] = parts.map((part) => {
    const div = doc.createElement(blockTag);
    div.innerHTML = part;
    return div;
  });

  const insertBefore = element.nextSibling;
  for (const replacement of replacements) {
    parent.insertBefore(replacement, insertBefore);
  }
  parent.removeChild(element);

  return replacements;
};

const hoistOutOfParagraph = (element: Element) => {
  const paragraph = findStructuralParent(element.parentElement, null);
  if (!paragraph || paragraph.getAttribute('_tag') !== PARAGRAPH_TAG) return;

  const parent = paragraph.parentElement;
  if (!parent) return;

  parent.insertBefore(element, paragraph.nextSibling);
};

export const fixNestedPastedParagraphs = (body: ParentNode) => {
  const nestedParagraphs = Array.from(
    body.querySelectorAll(`[_tag="${PARAGRAPH_TAG}"] [_tag="${PARAGRAPH_TAG}"]`),
  );

  for (const nested of nestedParagraphs) {
    hoistOutOfParagraph(nested);
  }
};

const tagAsParagraph = (
  element: Element,
  deps: NormalizePastedParagraphsDeps,
) => {
  const doc = element.ownerDocument;
  if (!doc) return;

  let target = element;
  if (target.nodeName.toLowerCase() !== deps.blockTag) {
    const replacement = doc.createElement(deps.blockTag);
    while (target.firstChild) {
      replacement.appendChild(target.firstChild);
    }
    target.parentNode?.replaceChild(replacement, target);
    target = replacement;
  }

  target.setAttribute('_tag', PARAGRAPH_TAG);
  target.setAttribute('id', deps.getUniqueId('dom_'));
  target.setAttribute('_textallowed', String(deps.paragraphCanContainText));
};

export const normalizePastedParagraphsInFragment = (
  root: Element,
  deps: NormalizePastedParagraphsDeps,
) => {
  const candidates = Array.from(
    root.querySelectorAll(`${deps.blockTag}:not([_tag]), p:not([_tag])`),
  ).filter((element) => root.contains(element));

  for (const candidate of candidates) {
    if (!isUntaggedBlock(candidate, deps.blockTag)) continue;

    const parentTag = getEffectiveParentTag({
      element: candidate,
      root,
      insertionParentTag: deps.insertionParentTag,
    });

    if (!canTagAsParagraph(parentTag, deps.isParagraphValidInParent)) continue;

    hoistOutOfParagraph(candidate);

    const blocks =
      candidate.nodeName.toLowerCase() === deps.blockTag
        ? splitDivOnParagraphBreaks(candidate as HTMLDivElement, deps.blockTag)
        : [candidate];

    for (const block of blocks) {
      if (block.hasAttribute('_tag')) continue;
      if (!isUntaggedBlock(block, deps.blockTag)) continue;
      if (isEffectivelyEmptyParagraph(block)) continue;
      tagAsParagraph(block, deps);
    }
  }

  removeEmptyParagraphs(root, deps.blockTag);
};

export const getInsertionStructuralParentTag = (editor: {
  selection: { getNode: () => Node };
  getBody: () => HTMLElement;
}): string | null => {
  const body = editor.getBody();
  let node: Node | null = editor.selection.getNode();
  if (!node) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  const structuralParent = findStructuralParent(node as Element, body);
  return structuralParent?.getAttribute('_tag') ?? null;
};

export const normalizePastedParagraphs = (writer: Writer, root: Element) => {
  if (!writer.editor) return;

  const schemaManager = writer.schemaManager;
  normalizePastedParagraphsInFragment(root, {
    getUniqueId: (prefix) => writer.getUniqueId(prefix),
    isParagraphValidInParent: (parentTag) =>
      schemaManager.isTagValidChildOfParent(PARAGRAPH_TAG, parentTag),
    paragraphCanContainText: schemaManager.canTagContainText(PARAGRAPH_TAG),
    blockTag: schemaManager.getBlockTag(),
    insertionParentTag: getInsertionStructuralParentTag(writer.editor),
  });
};
