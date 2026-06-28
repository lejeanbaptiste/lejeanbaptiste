import type { ApplyTagResult } from './tagCommand';
import { applyRenameTag, applyWrapTag } from './tagCommand';
import {
  clearTagWalkHighlight,
  highlightTagWalkElement,
  highlightTagWalkRange,
  scrollTagWalkTargetIntoView,
} from './tagWalkHighlight';

export interface PropagateResult {
  applied: number;
  skipped: number;
}

const getWriter = () => window.writer;

const isInsideStructuralHeader = (node: Node): boolean => {
  const headerTag = getWriter()?.schemaManager?.getHeader();
  if (!headerTag) return false;

  let current: Node | null = node;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element;
      if (element.getAttribute('_tag') === headerTag) return true;
      if (element.id === 'tinymce' || element.classList.contains('mce-content-body')) break;
    }
    current = current.parentNode;
  }

  return false;
};

const collectTextRanges = (root: Element, search: string): Range[] => {
  if (!search) return [];

  const ranges: Range[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();

  while (textNode) {
    if (!isInsideStructuralHeader(textNode)) {
      const text = textNode.textContent ?? '';
      let start = 0;
      while (start <= text.length) {
        const index = text.indexOf(search, start);
        if (index === -1) break;

        const range = root.ownerDocument.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + search.length);
        ranges.push(range);
        start = index + search.length;
      }
    }
    textNode = walker.nextNode();
  }

  return ranges;
};

const isInsideTagNamed = (range: Range, tagName: string): boolean => {
  let node: Node | null = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    const currentTag = element.getAttribute('_tag');
    if (currentTag === tagName) return true;
    if (currentTag) return false;
    if (element.id === 'tinymce' || element.classList.contains('mce-content-body')) break;
    node = node.parentNode;
  }

  return false;
};

const collectTaggedElements = (
  root: Element,
  tagName: string,
  textContent?: string,
): Element[] => {
  const matches: Element[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    const element = node as Element;
    if (element.getAttribute('_tag') === tagName) {
      if (isInsideStructuralHeader(element)) {
        node = walker.nextNode();
        continue;
      }
      const text = (element.textContent ?? '').trim();
      if (!textContent || text === textContent.trim()) {
        matches.push(element);
      }
    }
    node = walker.nextNode();
  }

  return matches;
};

export const countPropagatableMatches = (search: string, tagName: string): number => {
  const writer = getWriter();
  const body = writer?.editor?.getBody();
  if (!body || !search) return 0;

  return collectTextRanges(body, search).filter((range) => !isInsideTagNamed(range, tagName))
    .length;
};

export const countRenamableMatches = (oldTagName: string, textContent: string): number => {
  const writer = getWriter();
  const body = writer?.editor?.getBody();
  if (!body || !oldTagName) return 0;

  return collectTaggedElements(body, oldTagName, textContent || undefined).length;
};

export const propagateTagInFile = (search: string, tagName: string): PropagateResult => {
  const writer = getWriter();
  const editor = writer?.editor;
  const body = editor?.getBody();
  if (!editor || !body || !search) return { applied: 0, skipped: 0 };

  const ranges = collectTextRanges(body, search);
  let applied = 0;
  let skipped = 0;

  editor.undoManager.transact(() => {
    for (const range of ranges) {
      if (isInsideTagNamed(range, tagName)) {
        skipped += 1;
        continue;
      }

      editor.selection.setRng(range);
      const bookmark = editor.selection.getBookmark(1);
      const result = applyWrapTag(tagName, bookmark, 'add', true);
      if (result.applied) {
        applied += 1;
      } else {
        skipped += 1;
      }
    }
  });

  if (applied > 0) {
    writer.event('contentChanged').publish();
  }

  return { applied, skipped };
};

export const propagateRenameInFile = async (
  oldTagName: string,
  newTagName: string,
  textContent?: string,
): Promise<PropagateResult> => {
  const writer = getWriter();
  const editor = writer?.editor;
  const body = editor?.getBody();
  if (!editor || !body || !oldTagName || !newTagName) return { applied: 0, skipped: 0 };

  const elements = collectTaggedElements(body, oldTagName, textContent || undefined);
  let applied = 0;
  let skipped = 0;

  for (const element of elements) {
    const result = await applyRenameTag(newTagName, element);
    if (result.applied) applied += 1;
    else skipped += 1;
  }

  return { applied, skipped };
};

export const listUntaggedRanges = (search: string, tagName: string): Range[] => {
  const writer = getWriter();
  const body = writer?.editor?.getBody();
  if (!body || !search) return [];

  return collectTextRanges(body, search).filter((range) => !isInsideTagNamed(range, tagName));
};

export const listRenamableElements = (oldTagName: string, textContent?: string): Element[] => {
  const writer = getWriter();
  const body = writer?.editor?.getBody();
  if (!body || !oldTagName) return [];

  return collectTaggedElements(body, oldTagName, textContent || undefined);
};

export const findNextUntaggedRange = (
  search: string,
  tagName: string,
  afterRange?: Range | null,
): Range | null => {
  const ranges = listUntaggedRanges(search, tagName);
  if (!afterRange) return ranges[0] ?? null;

  for (const range of ranges) {
    if (range.compareBoundaryPoints(Range.END_TO_START, afterRange) > 0) {
      return range;
    }
  }

  return null;
};

export const findNextRenamableElement = (
  oldTagName: string,
  textContent: string,
  afterElement?: Element | null,
): Element | null => {
  const elements = listRenamableElements(oldTagName, textContent || undefined);
  if (!afterElement) return elements[0] ?? null;

  let seenAfter = false;
  for (const element of elements) {
    if (seenAfter) return element;
    if (element === afterElement) seenAfter = true;
  }

  return null;
};

export const selectRange = (range: Range) => {
  const editor = getWriter()?.editor;
  if (!editor) return;
  editor.focus();
  editor.selection.setRng(range.cloneRange());
};

export const selectElement = (element: Element) => {
  const editor = getWriter()?.editor;
  if (!editor) return;
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(true);
  editor.selection.setRng(range);
};

export const applyQueueWalkStepAt = (
  search: string,
  tagName: string,
  rangeIndex: number,
): { result: ApplyTagResult; done: boolean } => {
  const editor = getWriter()?.editor;
  if (!editor) {
    return { result: { applied: false, error: 'Editor not ready' }, done: false };
  }

  try {
    clearTagWalkHighlight();

    const ranges = listUntaggedRanges(search, tagName);
    if (ranges.length === 0 || rangeIndex >= ranges.length) {
      return { result: { applied: false }, done: true };
    }

    const rangeToTag = ranges[rangeIndex]!;
    selectRange(rangeToTag);
    scrollTagWalkTargetIntoView(rangeToTag);

    let result: ApplyTagResult = { applied: false };
    const runApply = () => {
      const bm = editor.selection.getBookmark(1);
      result = applyWrapTag(tagName, bm, 'add', false);
    };
    if (editor.undoManager?.transact) {
      editor.undoManager.transact(runApply);
    } else {
      runApply();
    }

    return { result, done: false };
  } catch (error) {
    return { result: { applied: false, error: String(error) }, done: false };
  }
};

/** @deprecated Use applyQueueWalkStepAt with walk index from the controller. */
export const applyQueueWalkStep = (
  search: string,
  tagName: string,
): { result: ApplyTagResult; done: boolean } => applyQueueWalkStepAt(search, tagName, 0);

export const applyRenameQueueWalkStepAt = async (
  oldTagName: string,
  newTagName: string,
  textContent: string,
  elementIndex: number,
): Promise<{ result: ApplyTagResult; element: Element | null; done: boolean }> => {
  clearTagWalkHighlight();

  const elements = listRenamableElements(oldTagName, textContent);
  if (elements.length === 0 || elementIndex >= elements.length) {
    return { result: { applied: false }, element: null, done: true };
  }

  const nextElement = elements[elementIndex]!;
  selectElement(nextElement);
  scrollTagWalkTargetIntoView(nextElement);
  const result = await applyRenameTag(newTagName, nextElement);

  return { result, element: nextElement, done: false };
};

export const applyRenameQueueWalkStep = async (
  oldTagName: string,
  newTagName: string,
  textContent: string,
): Promise<{ result: ApplyTagResult; element: Element | null; done: boolean }> => {
  clearTagWalkHighlight();

  const nextElement = findNextRenamableElement(oldTagName, textContent);
  if (!nextElement) {
    return { result: { applied: false }, element: null, done: true };
  }

  selectElement(nextElement);
  scrollTagWalkTargetIntoView(nextElement);
  const result = await applyRenameTag(newTagName, nextElement);

  if (result.applied) {
    const previewElement = findNextRenamableElement(oldTagName, textContent);
    if (previewElement) {
      highlightTagWalkElement(previewElement);
      scrollTagWalkTargetIntoView(previewElement);
    }
  }

  return { result, element: nextElement, done: false };
};

export const previewQueueWalkTarget = (
  search: string,
  tagName: string,
  rangeIndex = 0,
): Range | null => {
  clearTagWalkHighlight();
  const ranges = listUntaggedRanges(search, tagName);
  const index = Math.min(Math.max(rangeIndex, 0), Math.max(ranges.length - 1, 0));
  const nextRange = ranges[index] ?? null;
  if (nextRange) {
    highlightTagWalkRange(nextRange);
    scrollTagWalkTargetIntoView(nextRange);
  }
  return nextRange;
};

export const previewRenameWalkTarget = (
  oldTagName: string,
  textContent: string,
  elementIndex = 0,
): Element | null => {
  clearTagWalkHighlight();
  const elements = listRenamableElements(oldTagName, textContent);
  const index = Math.min(Math.max(elementIndex, 0), Math.max(elements.length - 1, 0));
  const nextElement = elements[index] ?? null;
  if (nextElement) {
    highlightTagWalkElement(nextElement);
    scrollTagWalkTargetIntoView(nextElement);
  }
  return nextElement;
};
