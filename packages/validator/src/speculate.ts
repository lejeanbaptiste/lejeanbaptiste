import { Validator } from '@cwrc/salve-dom-leafwriter';
import { logEnabledFor } from './log';
import type { NodeDetail, TargetSelection } from './types';
import { evaluateXPath } from './utilities';

export interface SpeculateRequest {
  container: Node;
  index: number;
  possibleNodes: NodeDetail[];
  selection?: TargetSelection;
}

export const speculateAt = (
  { document, validator }: { document: Document; validator: Validator },
  { container, index, possibleNodes, selection }: SpeculateRequest,
) => {
  if (!document || !validator) {
    throw new Error('vEditor: Document or Validator not set');
  }

  if (logEnabledFor('DEBUG')) console.time('Speculative Possibilities');

  const speculativeValidNodes = [...possibleNodes];

  for (const node of possibleNodes) {
    const speculativeContent = generateSpeculativeContent(document, node, selection, container);
    if (!speculativeContent) continue;

    const speculationError = validator.speculativelyValidate(container, index, speculativeContent);

    //Specualtive validate returns errors when it is not possible to add a specific tag (or event) in the container.
    //We specify if the node will invalidade the document here.
    node.invalid = !!speculationError;
  }

  if (logEnabledFor('DEBUG')) console.timeEnd('Speculative Possibilities');
  return speculativeValidNodes;
};

const generateSpeculativeContent = (
  document: Document,
  tag: NodeDetail,
  selection?: TargetSelection,
  container?: Node,
) => {
  if (!document) throw new Error('vEditor: Document not set');

  if (!selection) {
    const speculativeContent = document.createElement(tag.name);
    return speculativeContent;
  }

  const {
    endContainerIndex,
    containerIndex,
    type,
    xpath,
    startContainerIndex,
    skip,
    startOffset,
    endOffset,
  } = selection;

  if (type === 'around') {
    if (!xpath) return;
    return processSpeculativeContentNode(document, tag, { xpath });
  }

  if (type === 'after') {
    if (!xpath || typeof containerIndex !== 'number') return;
    return processSpeculativeContentAfter(document, tag, { xpath, containerIndex });
  }

  if (type === 'before') {
    if (!xpath || typeof containerIndex !== 'number') return;
    return processSpeculativeContentBefore(document, tag, { xpath, containerIndex });
  }

  if (type === 'change') {
    if (
      !xpath ||
      typeof endContainerIndex !== 'number' ||
      typeof startContainerIndex !== 'number'
    ) {
      return;
    }
    return processSpeculativeContentChildNodes(document, tag, {
      xpath,
      startContainerIndex,
      endContainerIndex,
      skip,
    });
  }

  if (type === 'inside') {
    if (
      !xpath ||
      typeof endContainerIndex !== 'number' ||
      typeof startContainerIndex !== 'number'
    ) {
      return;
    }
    return processSpeculativeContentChildNodes(document, tag, {
      xpath,
      startContainerIndex,
      endContainerIndex,
      skip,
    });
  }

  if (type === 'span') {
    if (
      typeof startContainerIndex !== 'number' ||
      typeof startOffset !== 'number' ||
      typeof endContainerIndex !== 'number' ||
      typeof endOffset !== 'number' ||
      !container
    ) {
      return;
    }
    return processSpeculativeContentSpan(document, container, tag, {
      startContainerIndex,
      startOffset,
      endContainerIndex,
      endOffset,
    });
  }
};

const processSpeculativeContentSpan = (
  document: Document,
  container: Node,
  tag: NodeDetail,
  selection: Required<
    Pick<TargetSelection, 'endContainerIndex' | 'endOffset' | 'startContainerIndex' | 'startOffset'>
  >,
) => {
  const { startContainerIndex, startOffset, endContainerIndex, endOffset } = selection;

  const speculativeContent = document.createElement(tag.name);

  Array.from(container.childNodes).forEach((child: ChildNode, index) => {
    if (index === startContainerIndex) {
      const textContet = child.textContent;
      if (!textContet) return;
      const textIn = textContet.substring(startOffset, textContet.length);
      speculativeContent.append(textIn);
    }

    if (index > startContainerIndex && index < endContainerIndex) {
      const clone = child.cloneNode(true);
      speculativeContent.append(clone);
    }

    if (index === endContainerIndex) {
      const textContet = child.textContent;
      if (!textContet) return;
      const textIn = textContet.substring(0, endOffset);
      speculativeContent.append(textIn);
    }
  });

  return speculativeContent;
};

const processSpeculativeContentChildNodes = (
  document: Document,
  tag: NodeDetail,
  selection: Required<
    Pick<TargetSelection, 'endContainerIndex' | 'startContainerIndex' | 'xpath'>
  > &
    Pick<TargetSelection, 'skip'>,
) => {
  const { startContainerIndex, endContainerIndex, skip, xpath } = selection;

  if (skip === tag.name) return;

  const contentContainer = evaluateXPath(xpath, document);
  if (!contentContainer) return;

  const speculativeContent = document.createElement(tag.name);

  Array.from(contentContainer.childNodes).forEach((child: ChildNode, index) => {
    if (index >= startContainerIndex && index <= endContainerIndex) {
      const clone = child.cloneNode(true);
      speculativeContent.append(clone);
    }
  });

  return speculativeContent;
};

const processSpeculativeContentBefore = (
  document: Document,
  tag: NodeDetail,
  selection: Required<Pick<TargetSelection, 'containerIndex' | 'xpath'>>,
) => {
  if (!document) throw new Error('vEditor: Document not set');

  const { containerIndex, xpath } = selection;

  const contentContainer = evaluateXPath(xpath, document);
  if (!contentContainer) return;

  const specArray: Node[] = [];

  const speculativeContent =
    tag.type === 'text' ? document.createTextNode('test') : document.createElement(tag.name);

  Array.from(contentContainer.childNodes).forEach((child: ChildNode, index) => {
    if (index <= containerIndex) {
      const clone = child.cloneNode(true);
      specArray.push(clone);
    }
    if (index === containerIndex) {
      specArray.push(speculativeContent);
    }
    if (index > containerIndex) {
      const clone = child.cloneNode(true);
      specArray.push(clone);
    }
  });

  return specArray;
};

const processSpeculativeContentAfter = (
  document: Document,
  tag: NodeDetail,
  selection: Required<Pick<TargetSelection, 'containerIndex' | 'xpath'>>,
) => {
  const { containerIndex, xpath } = selection;

  const contentContainer = evaluateXPath(xpath, document);
  if (!contentContainer) return;

  const specArray = [];

  const speculativeContent =
    tag.type === 'text' ? document.createTextNode('test') : document.createElement(tag.name);

  specArray.push(speculativeContent);

  Array.from(contentContainer.childNodes).forEach((child: ChildNode, index) => {
    if (index >= containerIndex) {
      const clone = child.cloneNode(true);
      specArray.push(clone);
    }
  });

  return specArray;
};

const processSpeculativeContentNode = (
  document: Document,
  tag: NodeDetail,
  selection: Required<Pick<TargetSelection, 'xpath'>>,
) => {
  if (tag.type === 'text') return;

  const { xpath } = selection;

  const speculativeContent = document.createElement(tag.name);
  const node = evaluateXPath(xpath, document);
  if (!node) return;

  const clone = node.cloneNode(true);
  speculativeContent.append(clone);

  return speculativeContent;
};
