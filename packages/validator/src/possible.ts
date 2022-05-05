import { ElementDetail } from './sharedTypes';
import { evaluateXPath } from './utils';
import VirtualEditor from './virtualEditor';

type SelectionType = 'span' | 'change' | 'before' | 'after' | 'around' | 'inside';
interface SpeculateRequest {
  container: Node;
  index: number;
  possibleTags: ElementDetail[];
  selection?: GetValidTagsAtParametersSelection;
}

type ProcessSpeculativeContentFunction = (
  vEditor: VirtualEditor,
  tag: ElementDetail,
  selection: GetValidTagsAtParametersSelection,
  container?: Node
) => HTMLElement | HTMLElement[] | Node[] | undefined;

export interface GetValidTagsAtParametersSelection {
  containerIndex?: number;
  endContainerIndex?: number;
  endOffset?: number;
  startContainerIndex?: number;
  startOffset?: number;
  skip?: string;
  type?: SelectionType;
  xpath?: string;
}

export interface GetValidTagsAtParameters {
  index: number;
  xpath: string;
  speculate?: boolean;
  selection?: GetValidTagsAtParametersSelection;
}
export interface GetValidTagsAtResponse {
  index: number;
  xpath: string;
  possible: ElementDetail[];
  speculative?: ElementDetail[];
}

// const skipEvent = new Set(['leaveStartTag', 'endTag', 'text']);
const processSpeculativeContent: Map<SelectionType, ProcessSpeculativeContentFunction> = new Map();

export const speculateAt = (
  vEditor: VirtualEditor,
  { container, index, possibleTags, selection }: SpeculateRequest
) => {
  // if (!vEditor.validator) throw new Error('vEditor: Validator not set');

  // console.time('Speculative Possibilities');
  const speculativePossibility: ElementDetail[] = [];

  for (const tag of possibleTags) {
    const specContent = speculativeContent(vEditor, tag, selection, container);
    if (!specContent) continue;

    const speculationError = vEditor.validator?.speculativelyValidate(container, index, specContent);

    //specualtive validate returns an errors when it is not possible to add a
    //specific tag (or event) in the container we add the ones that doesn't have errors.
    if (!speculationError) speculativePossibility.push(tag);
  }

  // console.timeEnd('Speculative Possibilities');
  return speculativePossibility;
};

const speculativeContent = (
  vEditor: VirtualEditor,
  tag: ElementDetail,
  selection?: GetValidTagsAtParametersSelection,
  container?: Node
): Node | Node[] | undefined => {
  //* This condition might be wrong, since it prevents further tests with selection to add Before, After, around, and inside.
  //* However, it somehow works well.
  //* This need to be revised
  if (!selection || selection.type) {
    // if (!vEditor.document) throw new Error('vEditor: Document not set');
    const specContent = vEditor.document?.createElement(tag.name);
    return specContent;
  }

  const { type } = selection;
  if (!type) throw new Error('type not set');

  const contentProcessor = processSpeculativeContent.get(type);
  if (!contentProcessor) throw new Error('selection type undefined');

  return contentProcessor(vEditor, tag, selection, container);
};

const processSpeculativeContentSpan = (
  vEditor: VirtualEditor,
  tag: ElementDetail,
  selection: GetValidTagsAtParametersSelection,
  container?: Node
) => {
  if (!container) throw new Error('vEditor: No Container');
  if (!vEditor.document) throw new Error('vEditor: Document not set');

  const { startContainerIndex, startOffset, endContainerIndex, endOffset } = selection;
  if (!startContainerIndex) throw new Error('startContainerIndex not set');
  if (!endContainerIndex) throw new Error('startContainerIndex not set');
  if (!startOffset) throw new Error('startOffset not set');
  if (!endOffset) throw new Error('endOffset not set');

  const specContent = vEditor.document.createElement(tag.name);

  Array.from(container.childNodes).forEach((child: ChildNode, i) => {
    if (i === startContainerIndex) {
      const textContet = child.textContent;
      if (!textContet) return;
      const textIn = textContet.substring(startOffset, textContet.length);
      specContent.append(textIn);
    }

    if (i > startContainerIndex && i < endContainerIndex) {
      const clone = child.cloneNode(true);
      specContent.append(clone);
    }

    if (i === endContainerIndex) {
      const textContet = child.textContent;
      if (!textContet) return;
      const textIn = textContet.substring(0, endOffset);
      specContent.append(textIn);
    }
  });

  return specContent;
};

const processSpeculativeContenChildNodes = (
  vEditor: VirtualEditor,
  tag: ElementDetail,
  selection: GetValidTagsAtParametersSelection
) => {
  if (!vEditor.document) throw new Error('vEditor: Document not set');

  const { startContainerIndex, endContainerIndex, skip, xpath } = selection;
  if (!startContainerIndex || !endContainerIndex || !xpath)
    throw new Error('startContainerIndex or startContainerIndex or xpath not set');

  if (skip === tag.name) return;

  const specContent = vEditor.document.createElement(tag.name);
  const contentContainer = evaluateXPath(xpath, vEditor.document);
  if (!contentContainer) return;

  Array.from(contentContainer.childNodes).forEach((child: ChildNode, i) => {
    if (i >= startContainerIndex && i <= endContainerIndex) {
      const clone = child.cloneNode(true);
      specContent.append(clone);
    }
  });

  return specContent;
};

const processSpeculativeContentBefore = (
  vEditor: VirtualEditor,
  tag: ElementDetail,
  selection: GetValidTagsAtParametersSelection
) => {
  if (!vEditor.document) throw new Error('vEditor: Document not set');

  const { containerIndex, xpath } = selection;
  if (!containerIndex || !xpath) throw new Error('containerIndex or xpath not set');

  const specArray: Node[] = [];

  const specContent = vEditor.document.createElement(tag.name);
  const contentContainer = evaluateXPath(xpath, vEditor.document);
  if (!contentContainer) return;

  Array.from(contentContainer.childNodes).forEach((child: ChildNode, i) => {
    if (i <= containerIndex) {
      const clone = child.cloneNode(true);
      specArray.push(clone);
    }
    if (i === containerIndex) {
      specArray.push(specContent);
    }
    if (i > containerIndex) {
      const clone = child.cloneNode(true);
      specArray.push(clone);
    }
  });

  return specArray;
};

const processSpeculativeContentAfter = (
  vEditor: VirtualEditor,
  tag: ElementDetail,
  selection: GetValidTagsAtParametersSelection
) => {
  if (!vEditor.document) throw new Error('vEditor: Document not set');

  const { containerIndex, xpath } = selection;
  if (!containerIndex || !xpath) throw new Error('containerIndex or xpath not set');

  const specArray = [];

  const specContent = vEditor.document.createElement(tag.name);
  specArray.push(specContent);

  const contentContainer = evaluateXPath(xpath, vEditor.document);
  if (!contentContainer) return;

  Array.from(contentContainer.childNodes).forEach((child: ChildNode, i) => {
    if (i >= containerIndex) {
      const clone = child.cloneNode(true);
      specArray.push(clone);
    }
  });

  return specArray;
};

const processSpeculativeContentNode = (
  vEditor: VirtualEditor,
  tag: ElementDetail,
  selection: GetValidTagsAtParametersSelection
) => {
  if (!vEditor.document) throw new Error('vEditor: Document not set');

  const { xpath } = selection;
  if (!xpath) throw new Error('xpath not set');

  const specContent = vEditor.document.createElement(tag.name);
  const node = evaluateXPath(xpath, vEditor.document);
  if (!node) return;

  const clone = node.cloneNode(true);
  specContent.append(clone);

  return specContent;
};

processSpeculativeContent.set('span', processSpeculativeContentSpan);
processSpeculativeContent.set('change', processSpeculativeContenChildNodes);
processSpeculativeContent.set('before', processSpeculativeContentBefore);
processSpeculativeContent.set('after', processSpeculativeContentAfter);
processSpeculativeContent.set('around', processSpeculativeContentNode);
processSpeculativeContent.set('inside', processSpeculativeContenChildNodes);
