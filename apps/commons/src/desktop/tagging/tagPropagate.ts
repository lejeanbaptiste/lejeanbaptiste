import type { ApplyTagResult } from './tagCommand';
import { applyRenameTag, applyWrapTag } from './tagCommand';
import { getBookmark } from './taggerRuntime';
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

const TEMPLATE_EXCLUDED_TAGS = new Set([
  'pb',
  'lb',
  'supplied',
  'surplus',
  'choice',
  'sic',
  'corr',
]);

interface VisibleTextSegment {
  node: Text;
  start: number;
  end: number;
}

interface NestedTagTemplate {
  end: number;
  start: number;
  tagName: string;
}

const ignoredVisibleTextAncestor = (node: Node): boolean => {
  let current: Node | null = node.parentNode;
  while (current?.nodeType === Node.ELEMENT_NODE) {
    const tag = (current as Element).getAttribute('_tag')?.toLowerCase();
    if (tag === 'sic') return true;
    if (tag === 'teiheader') return true;
    current = current.parentNode;
  }
  return false;
};

const collectVisibleTextSegments = (
  root: Element,
): { segments: VisibleTextSegment[]; text: string } => {
  const segments: VisibleTextSegment[] = [];
  let text = '';
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (!ignoredVisibleTextAncestor(node)) {
      const value = node.textContent ?? '';
      if (value) {
        segments.push({ node, start: text.length, end: text.length + value.length });
        text += value;
      }
    }
    node = walker.nextNode() as Text | null;
  }
  return { segments, text };
};

const rangeForTextOffsets = (
  root: Element,
  segments: VisibleTextSegment[],
  start: number,
  end: number,
): Range | null => {
  const first = segments.find((segment) => start >= segment.start && start < segment.end);
  const last = segments.find((segment) => end > segment.start && end <= segment.end);
  if (!first || !last) return null;
  const range = root.ownerDocument.createRange();
  range.setStart(first.node, start - first.start);
  range.setEnd(last.node, end - last.start);
  return range;
};

const tagNameFor = (element: Element): string | null => {
  const tagName = element.getAttribute('_tag')?.trim();
  if (!tagName || TEMPLATE_EXCLUDED_TAGS.has(tagName.toLowerCase())) return null;
  if (element.hasAttribute('_entity') || element.classList.contains('correction')) return null;
  return tagName;
};

const extractNestedTagTemplate = (
  sourceRange: Range | null | undefined,
  outerTagName: string,
): NestedTagTemplate[] => {
  if (!sourceRange || sourceRange.collapsed) return [];
  const fragment = sourceRange.cloneContents();
  const root = sourceRange.startContainer.ownerDocument!.createElement('div');
  root.appendChild(fragment);
  const { segments, text } = collectVisibleTextSegments(root);
  if (!text) return [];

  const templates: NestedTagTemplate[] = [];
  for (const element of Array.from(root.querySelectorAll('[_tag]'))) {
    const tagName = tagNameFor(element);
    if (!tagName || tagName === outerTagName) continue;
    let start = Number.POSITIVE_INFINITY;
    let end = -1;
    for (const segment of segments) {
      if (!element.contains(segment.node)) continue;
      start = Math.min(start, segment.start);
      end = Math.max(end, segment.end);
    }
    if (Number.isFinite(start) && end > start) templates.push({ tagName, start, end });
  }
  return templates.sort((a, b) => a.end - a.start - (b.end - b.start));
};

const collectTextMatches = (root: Element, search: string): { end: number; start: number }[] => {
  const { text } = collectVisibleTextSegments(root);
  const matches: { end: number; start: number }[] = [];
  let start = 0;
  while (start <= text.length) {
    const index = text.indexOf(search, start);
    if (index === -1) break;
    matches.push({ start: index, end: index + search.length });
    start = index + search.length;
  }
  return matches;
};

const tagOverlap = (
  range: Range,
  root: Element,
  tagName: string,
): 'complete' | 'conflict' | null => {
  for (const element of Array.from(root.querySelectorAll('[_tag]'))) {
    if (element.getAttribute('_tag') !== tagName || !range.intersectsNode(element)) continue;
    const containsStart =
      element === range.startContainer || element.contains(range.startContainer);
    const containsEnd = element === range.endContainer || element.contains(range.endContainer);
    return containsStart && containsEnd ? 'complete' : 'conflict';
  }
  return null;
};

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
  const { segments } = collectVisibleTextSegments(root);
  return collectTextMatches(root, search)
    .map(({ start, end }) => rangeForTextOffsets(root, segments, start, end))
    .filter((range): range is Range => Boolean(range))
    .filter((range) => !isInsideStructuralHeader(range.startContainer));
};

const collectTaggedElements = (root: Element, tagName: string, textContent?: string): Element[] => {
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

  return collectTextRanges(body, search).filter((range) => !tagOverlap(range, body, tagName))
    .length;
};

export const countRenamableMatches = (oldTagName: string, textContent: string): number => {
  const writer = getWriter();
  const body = writer?.editor?.getBody();
  if (!body || !oldTagName) return 0;

  return collectTaggedElements(body, oldTagName, textContent || undefined).length;
};

export const propagateTagInFile = (
  search: string,
  tagName: string,
  sourceRange?: Range | null,
): PropagateResult => {
  const writer = getWriter();
  const editor = writer?.editor;
  const body = editor?.getBody();
  if (!editor || !body || !search) return { applied: 0, skipped: 0 };

  const templates = extractNestedTagTemplate(sourceRange, tagName);
  const matches = collectTextMatches(body, search);
  const occurrences = matches
    .map((match) => {
      const { segments } = collectVisibleTextSegments(body);
      return { ...match, range: rangeForTextOffsets(body, segments, match.start, match.end) };
    })
    .filter((match): match is typeof match & { range: Range } => Boolean(match.range))
    .reverse();
  const ranges = templates.length
    ? occurrences
    : collectTextRanges(body, search)
        .reverse()
        .map((range) => ({ start: 0, end: 0, range }));
  let applied = 0;
  let skipped = 0;

  editor.undoManager.transact(() => {
    for (const occurrence of ranges) {
      const range = occurrence.range;
      const outerOverlap = tagOverlap(range, body, tagName);
      if (outerOverlap) {
        skipped += 1;
        continue;
      }

      const matchStart = occurrence.start;
      let valid = matchStart >= 0;
      if (valid && templates.length) {
        for (const template of templates) {
          const { segments } = collectVisibleTextSegments(body);
          const nestedRange = rangeForTextOffsets(
            body,
            segments,
            matchStart + template.start,
            matchStart + template.end,
          );
          if (!nestedRange || tagOverlap(nestedRange, body, template.tagName) === 'conflict') {
            valid = false;
            break;
          }
        }
      }
      if (!valid) {
        skipped += 1;
        continue;
      }

      if (templates.length) {
        for (const template of templates) {
          const { segments } = collectVisibleTextSegments(body);
          const nestedRange = rangeForTextOffsets(
            body,
            segments,
            matchStart + template.start,
            matchStart + template.end,
          );
          if (!nestedRange || tagOverlap(nestedRange, body, template.tagName) === 'complete')
            continue;
          editor.selection.setRng(nestedRange);
          const nestedResult = applyWrapTag(template.tagName, getBookmark(editor), 'add', true);
          if (!nestedResult.applied) valid = false;
        }
      }
      if (!valid) {
        skipped += 1;
        continue;
      }

      const { segments } = collectVisibleTextSegments(body);
      const currentRange =
        templates.length && matchStart >= 0
          ? rangeForTextOffsets(body, segments, matchStart, matchStart + search.length)
          : range;
      if (!currentRange) {
        skipped += 1;
        continue;
      }
      editor.selection.setRng(currentRange);
      const bookmark = getBookmark(editor);
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

  return collectTextRanges(body, search).filter((range) => !tagOverlap(range, body, tagName));
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
      const bm = getBookmark(editor);
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
