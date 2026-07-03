import type { NodeDetail, Target as PossibleNodesAtTarget } from '@cwrc/leafwriter-validator';
import { DEFAULT_INSERT_TAG } from './keybindings';
import type { TagCommandMode } from './tagCommand';
import { getSelectionRange } from './taggerRuntime';

export interface EditorTagContext {
  element: Element;
  hasContentSelection: boolean;
  rng: Range;
  tagElement: Element | null;
}

const getWriter = () => window.writer;

const childIndexInElement = (element: Element, range: Range, end = false): number => {
  const container = end ? range.endContainer : range.startContainer;
  let node: Node | null = container;
  while (node && node.parentNode !== element) {
    node = node.parentNode;
  }
  if (!node) return 0;
  return Math.max(0, Array.from(element.childNodes).indexOf(node as ChildNode));
};

const ensureValidatorReady = async (): Promise<boolean> => {
  const writer = getWriter();
  const validatorActions = writer?.overmindActions?.validator;
  if (!validatorActions) return false;

  const state = writer?.overmindState?.validator;
  if (!state?.hasWorkerValidator) {
    await validatorActions.loadValidator();
  }
  if (!writer?.overmindState?.validator?.hasSchema) {
    await validatorActions.initialize();
  }

  return Boolean(
    writer?.overmindState?.validator?.hasWorkerValidator &&
      writer?.overmindState?.validator?.hasSchema,
  );
};

const syncValidatorState = async (): Promise<void> => {
  const validatorActions = getWriter()?.overmindActions?.validator;
  if (!validatorActions) return;
  await validatorActions.validate();
};

export const getEditorTagContext = (): EditorTagContext | null => {
  const writer = getWriter();
  const editor = writer?.editor;
  if (!editor) return null;

  const rng = getSelectionRange(editor);
  const hasContentSelection = !rng.collapsed && rng.toString().length > 0;

  const element =
    rng.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (rng.commonAncestorContainer as Element)
      : (rng.commonAncestorContainer.parentElement);
  if (!element?.hasAttribute('_tag')) return null;

  let tagElement: Element | null = null;
  let node: Node | null = editor.selection.getNode();
  while (node && node !== editor.getBody()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.hasAttribute('_tag')) {
        tagElement = el;
        break;
      }
    }
    node = node.parentNode;
  }

  return { element, hasContentSelection, rng, tagElement };
};

export const buildValidatorTarget = (
  mode: TagCommandMode,
  ctx: EditorTagContext,
): PossibleNodesAtTarget | null => {
  const writer = getWriter();
  if (!writer) return null;

  const { element, hasContentSelection, rng, tagElement } = ctx;

  if (mode === 'rename') {
    if (!tagElement?.parentNode) return null;
    const parentNode = tagElement.parentNode as Element;
    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return null;

    const elementChildren = Array.from(parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === tagElement);
    const selectionXpath = writer.utilities.getElementXPath(tagElement);
    const skip = tagElement.getAttribute('_tag') ?? undefined;

    return {
      xpath,
      index,
      selection: {
        type: 'change',
        xpath: selectionXpath ?? '',
        startContainerIndex: 0,
        endContainerIndex: elementChildren.length,
        skip,
      },
    };
  }

  if (mode === 'wrap' && hasContentSelection) {
    const xpath = writer.utilities.getElementXPath(element);
    if (!xpath) return null;

    const index = childIndexInElement(element, rng);
    const endContainerIndex = childIndexInElement(element, rng, true);

    const request: PossibleNodesAtTarget = { xpath, index };
    request.selection = {
      type: 'span',
      startContainerIndex: index,
      startOffset: rng.startOffset,
      endContainerIndex,
      endOffset: rng.endOffset,
    };
    return request;
  }

  // insert / lineBreak — tags valid inside the current structural element (match context menu)
  const targetElement = tagElement ?? element;
  const xpath = writer.utilities.getElementXPath(targetElement);
  if (!xpath) return null;

  const elementChildren = Array.from(targetElement.childNodes);
  let startContainerIndex = 0;
  let endContainerIndex = Math.max(0, elementChildren.length - 1);

  const childIndexForNode = (node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) {
      return elementChildren.indexOf(node as ChildNode);
    }
    let current: Node | null = node;
    while (current && current.parentNode !== targetElement) {
      current = current.parentNode;
    }
    return current ? elementChildren.indexOf(current as ChildNode) : -1;
  };

  if (rng.collapsed && rng.startContainer.nodeType === Node.TEXT_NODE) {
    const textIndex = childIndexForNode(rng.startContainer);
    if (textIndex >= 0) {
      startContainerIndex = textIndex;
      endContainerIndex = textIndex;
    }
  } else if (!rng.collapsed) {
    const startIdx = childIndexForNode(rng.startContainer);
    const endIdx = childIndexForNode(rng.endContainer);
    if (startIdx >= 0) startContainerIndex = startIdx;
    if (endIdx >= 0) endContainerIndex = endIdx;
  }

  return {
    xpath,
    index: 0,
    selection: {
      type: 'inside',
      xpath,
      startContainerIndex,
      endContainerIndex,
    },
  };
};

export const buildInsertAfterTarget = (ctx: EditorTagContext): PossibleNodesAtTarget | null => {
  const writer = getWriter();
  if (!writer) return null;

  const targetElement = ctx.tagElement ?? ctx.element;
  const parentNode = targetElement.parentNode as Element | null;
  if (!parentNode) return null;

  const xpath = writer.utilities.getElementXPath(parentNode);
  if (!xpath) return null;

  const elementChildren = Array.from(parentNode.childNodes);
  const index = elementChildren.findIndex((child) => child === targetElement);

  return {
    xpath,
    index: index >= 0 ? index : 0,
    selection: {
      type: 'after',
      xpath,
      containerIndex: index >= 0 ? index : 0,
    },
  };
};

export const syncValidatorDocument = async (): Promise<void> => {
  if (!(await ensureValidatorReady())) return;
  await syncValidatorState();
};

export const fetchTagSuggestions = async (
  target: PossibleNodesAtTarget | null,
): Promise<NodeDetail[]> => {
  if (!target) {
    return [];
  }

  const writer = getWriter();
  const validatorActions = writer?.overmindActions?.validator;

  try {
    const ready = await ensureValidatorReady();
    if (!ready || !validatorActions) return [];

    await syncValidatorState();

    const nodes =
      (await validatorActions.getPossibleNodesAt(target)) ??
      (await window.leafwriterValidator?.getPossibleNodesAt(target, {
        speculativeValidate: true,
      }))?.nodes?.filter((node: NodeDetail) => node.type === 'tag') ??
      [];

    return nodes.filter((node: NodeDetail) => node.type === 'tag');
  } catch {
    return [];
  }
};

export const pinParagraphInsertOption = (
  tags: NodeDetail[],
  mode: TagCommandMode,
  ctx: EditorTagContext | null,
): NodeDetail[] => {
  if ((mode !== 'insert' && mode !== 'lineBreak') || !ctx) return tags;

  const body = getWriter()?.editor?.getBody();
  if (!body) return tags;

  let current: Node | null = ctx.rng.startContainer;
  let paragraph: Element | null = null;
  while (current && current !== body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      if (el.getAttribute('_tag') === DEFAULT_INSERT_TAG) {
        paragraph = el;
        break;
      }
    }
    current = current.parentNode;
  }
  if (!paragraph) return tags;

  const pinned: NodeDetail = {
    name: DEFAULT_INSERT_TAG,
    type: 'tag',
    eventType: 'enterStartTag',
    invalid: false,
  };
  return [pinned, ...tags.filter((tag) => tag.name !== DEFAULT_INSERT_TAG)];
};

export const withInsertModeFallbacks = (
  tags: NodeDetail[],
  mode: TagCommandMode,
  ctx: EditorTagContext | null,
): NodeDetail[] => {
  if ((mode !== 'insert' && mode !== 'lineBreak') || tags.length > 0 || !ctx?.tagElement) {
    return tags;
  }

  const parentTag = ctx.tagElement.getAttribute('_tag');
  if (parentTag === DEFAULT_INSERT_TAG) {
    return [
      {
        name: DEFAULT_INSERT_TAG,
        type: 'tag',
        eventType: 'enterStartTag',
        invalid: false,
      },
    ];
  }

  return tags;
};

export const sortTagSuggestions = (
  tags: NodeDetail[],
  tagCounts: Record<string, number>,
  preferredName?: string,
): NodeDetail[] => {
  const sorted = [...tags].sort((a, b) => {
    if (a.invalid !== b.invalid) return a.invalid ? 1 : -1;
    const aCount = tagCounts[a.name] ?? 0;
    const bCount = tagCounts[b.name] ?? 0;
    if (aCount !== bCount) return bCount - aCount;
    return a.name.localeCompare(b.name);
  });

  if (!preferredName) return sorted;

  const preferredIndex = sorted.findIndex((tag) => tag.name === preferredName);
  if (preferredIndex <= 0) return sorted;

  const [preferred] = sorted.splice(preferredIndex, 1);
  return [preferred, ...sorted];
};

export const filterTagSuggestions = (tags: NodeDetail[], query: string): NodeDetail[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return tags;
  return tags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(trimmed) ||
      tag.fullName?.toLowerCase().includes(trimmed),
  );
};

export const getDefaultHighlightIndex = (
  tags: NodeDetail[],
  mode: TagCommandMode,
  lastUsedTag: string | null,
): number => {
  if (tags.length === 0) return 0;

  const preferred =
    mode === 'insert' || mode === 'lineBreak'
      ? DEFAULT_INSERT_TAG
      : lastUsedTag;

  if (!preferred) return 0;
  const index = tags.findIndex((tag) => tag.name === preferred && !tag.invalid);
  return index >= 0 ? index : 0;
};
