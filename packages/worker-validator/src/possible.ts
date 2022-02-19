import sortBy from 'lodash/sortBy';
import uniqBy from 'lodash/unionBy';
import { EventSet } from 'salve-annos/build/dist';
import { Tag } from './sharedTypes';
import { evaluateXPath, getFullNameFromDocumentation } from './utils';
import { virtualEditor } from './virtualEditor';

const skipEvent = new Set(['leaveStartTag', 'endTag', 'text']);
const processSpeculativeContent: Map<string, Function> = new Map();

export interface Selection {
  type?: string;
  startContainerIndex?: number;
  startOffset?: number;
  endContainerIndex?: number;
  endOffset?: number;
  skip?: string;
  xpath?: string;
  containerIndex?: number;
}

export interface PossibleRequest {
  xpath: string;
  index: number;
  selection?: Selection;
}
export interface PossibleResponse {
  xpath: string;
  index: number;
  tags: {
    possible: Tag[];
    speculative: Tag[];
  };
}

interface SpeculateRequest {
  container: Node;
  index: number;
  possibleTags: Tag[];
  selection?: Selection;
}

export const possibleAt = async ({
  xpath,
  index,
  selection,
}: PossibleRequest): Promise<PossibleResponse> => {
  const _type = selection ? ` - ${selection.type}` : '';
  console.groupCollapsed(`PossibleAt: ${xpath}${_type}`);
  console.time('Timer');

  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');
  if (!virtualEditor.validator) throw new Error('virtualEditor: Validator not set');

  const container = evaluateXPath(xpath, virtualEditor.document);
  const possibleAt: EventSet = virtualEditor.validator.possibleAt(container, index);
  const possibleTags = storePossibleTags(possibleAt);

  const speculativeTags =
    speculate({
      container,
      index,
      possibleTags,
      selection,
    }) ?? null;

  const result = {
    xpath,
    index,
    tags: {
      possible: possibleTags,
      speculative: speculativeTags,
    },
  };

  console.timeEnd('Timer');
  console.groupEnd();

  return result;
};

//Pepare to store possible tags
const storePossibleTags = (possibleAt: EventSet) => {
  let possibleTags: Tag[] = [];

  Array.from(possibleAt).forEach((event) => {
    if (skipEvent.has(event.name)) return;

    if ('namePattern' in event && 'name' in event.namePattern) {
      const { name, ns, documentation } = event.namePattern;
      const fullName = documentation ? getFullNameFromDocumentation(documentation) : undefined;
      possibleTags.push({ name, fullName });
    }
  });

  possibleTags = uniqBy(possibleTags, 'name');
  possibleTags = sortBy(possibleTags, ['name']);

  return possibleTags;
};

const speculate = ({ container, index, possibleTags, selection }: SpeculateRequest) => {
  if (!virtualEditor.validator) throw new Error('virtualEditor: Validator not set');

  // console.time('Speculative Possibilities');
  const speculativePossibility: Tag[] = [];

  for (const tag of possibleTags) {
    const specContent = speculativeContent(tag, selection, container);
    if (!specContent) continue;

    const speculationError = virtualEditor.validator.speculativelyValidate(
      container,
      index,
      specContent
    );

    //specualtive validate returns an errors when it is not possible to add a
    //specific tag (or event) in the container we add the ones that doesn't have errors.
    if (!speculationError) speculativePossibility.push(tag);
  }

  // console.timeEnd('Speculative Possibilities');
  return speculativePossibility;
};

const speculativeContent = (
  tag: Tag,
  selection?: Selection,
  container?: Node
): Node | Node[] | undefined => {
  if (!selection || selection.type) {
    if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');
    const specContent = virtualEditor.document.createElement(tag.name);
    return specContent;
  }

  const { type } = selection;
  if (!type) throw new Error('type not set');

  const contentProcessor = processSpeculativeContent.get(type);
  if (!contentProcessor) throw new Error('selection type undefined');

  return contentProcessor(tag, selection, container);
};

const processSpeculativeContentSpan = (tag: Tag, selection: Selection, container: Node) => {
  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');

  const { startContainerIndex, startOffset, endContainerIndex, endOffset } = selection;
  if (!startContainerIndex) throw new Error('startContainerIndex not set');
  if (!endContainerIndex) throw new Error('startContainerIndex not set');
  if (!startOffset) throw new Error('startOffset not set');
  if (!endOffset) throw new Error('endOffset not set');

  const specContent = virtualEditor.document.createElement(tag.name);

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

const processSpeculativeContenChildNodes = (tag: Tag, selection: Selection) => {
  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');

  const { startContainerIndex, endContainerIndex, skip, xpath } = selection;
  if (!startContainerIndex || !endContainerIndex || !xpath)
    throw new Error('startContainerIndex or startContainerIndex or xpath not set');

  if (skip === tag.name) return;

  const specContent = virtualEditor.document.createElement(tag.name);
  const contentContainer = evaluateXPath(xpath, virtualEditor.document);
  Array.from(contentContainer.childNodes).forEach((child: ChildNode, i) => {
    if (i >= startContainerIndex && i <= endContainerIndex) {
      const clone = child.cloneNode(true);
      specContent.append(clone);
    }
  });

  return specContent;
};

const processSpeculativeContentBefore = (tag: Tag, selection: Selection) => {
  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');

  const { containerIndex, xpath } = selection;
  if (!containerIndex || !xpath) throw new Error('containerIndex or xpath not set');

  const specArray: Node[] = [];

  const specContent = virtualEditor.document.createElement(tag.name);
  const contentContainer = evaluateXPath(xpath, virtualEditor.document);

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

const processSpeculativeContentAfter = (tag: Tag, selection: Selection) => {
  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');

  const { containerIndex, xpath } = selection;
  if (!containerIndex || !xpath) throw new Error('containerIndex or xpath not set');

  const specArray = [];

  const specContent = virtualEditor.document.createElement(tag.name);
  specArray.push(specContent);

  const contentContainer = evaluateXPath(xpath, virtualEditor.document);
  Array.from(contentContainer.childNodes).forEach((child: ChildNode, i) => {
    if (i >= containerIndex) {
      const clone = child.cloneNode(true);
      specArray.push(clone);
    }
  });

  return specArray;
};

const processSpeculativeContentNode = (tag: Tag, selection: Selection) => {
  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');

  const { xpath } = selection;
  if (!xpath) throw new Error('xpath not set');

  const specContent = virtualEditor.document.createElement(tag.name);
  const node = evaluateXPath(xpath, virtualEditor.document);
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
