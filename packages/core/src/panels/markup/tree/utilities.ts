import {
  defaultDropAnimation,
  DropAnimation,
  MeasuringStrategy,
  Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MouseEvent } from 'react';
import { isElement, log } from '../../../utilities';
import type { FlattenedItem, TreeItem, TreeItems, TreeItemType } from './types';

//TODO 'navigator.platform' is deprecated
export const iOS = /iPad|iPhone|iPod/.test(navigator.platform);

//TODO 'navigator.platform' is deprecated
export const isControlKey = (e: MouseEvent<any, any>) =>
  e.ctrlKey || (navigator.platform.toUpperCase().indexOf('MAC') >= 0 && e.metaKey);


// * SORTABLE AND DND FUNCTIONS

export const tagFilter: string[] = ['head', 'heading']; // array of tag names to filter tree by. "head" is for tei lite. "heading" is for cwrc entry.
const getDragDepth = (offset: number, indentationWidth: number) => {
  return Math.round(offset / indentationWidth);
};

export const getProjection = (
  items: FlattenedItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number
) => {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  if (!activeItem) return;

  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  if (!previousItem || !nextItem) return;

  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = getMaxDepth({ previousItem });
  const minDepth = getMinDepth({ nextItem });
  const depth = projectedDepth >= maxDepth ? maxDepth : minDepth;

  const getParentId = () => {
    if (depth === 0 || !previousItem) return null;
    if (depth === previousItem.depth) return previousItem.parentId;
    if (depth > previousItem.depth) return previousItem.id;
    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth);
    const newParentId = newParent?.parentId;
    return newParentId ?? null;
  };

  return { depth, maxDepth, minDepth, parentId: getParentId() };
};

const getMaxDepth = ({ previousItem }: { previousItem: FlattenedItem }) => {
  if (previousItem) return previousItem.depth + 1;
  return 0;
};

const getMinDepth = ({ nextItem }: { nextItem: FlattenedItem }) => {
  if (nextItem) return nextItem.depth;
  return 0;
};

const flatten = (
  items: TreeItems,
  parentId: UniqueIdentifier | null = null,
  depth = 0
): FlattenedItem[] => {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    return [
      ...acc,
      { ...item, parentId, depth, index },
      ...flatten(item?.children, item.id, depth + 1),
    ];
  }, []);
};

export const flattenTree = (items: TreeItems): FlattenedItem[] => {
  return flatten(items);
};

export const findItem = (items: TreeItem[], itemId: UniqueIdentifier) => {
  return items.find(({ id }) => id === itemId);
};

export const findItemDeep = (items: TreeItems, itemId: UniqueIdentifier): TreeItem | undefined => {
  for (const item of items) {
    const { id, children } = item;
    if (id === itemId) return item;

    if (children.length) {
      const child = findItemDeep(children, itemId);
      if (child) return child;
    }
  }
  return undefined;
};

export const dropAnimationConfig: DropAnimation = {
  keyframes({ transform }) {
    return [
      { opacity: 1, transform: CSS.Transform.toString(transform.initial) },
      {
        opacity: 0,
        transform: CSS.Transform.toString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5,
        }),
      },
    ];
  },
  easing: 'ease-out',
  sideEffects({ active }) {
    active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: defaultDropAnimation.duration,
      easing: defaultDropAnimation.easing,
      delay: 1,
    });
  },
};

export const measuring = {
  droppable: { strategy: MeasuringStrategy.Always },
};

export const adjustTranslate: Modifier = ({ transform }) => ({ ...transform });

// * TREE FUNCTIONS

interface GetNodesParams {
  index?: number;
  level?: number;
  node: Node;
  parent?: TreeItem;
  treeType: TreeItemType;
  xpath?: string;
}

/**
 * It takes a DOM element and returns a tree item
 * @param {GetItemsParams}  - an object with the following properties:
 * - `node` - the node to process
 * - `level` - the tree level
 * - `parent` - the tree item parent
 *
 * @returns A TreeItem with children.
 */
export const getNodes = ({ index = 0, level = 0, node, parent, treeType }: GetNodesParams) => {
  const { schemaManager } = window.writer;

  const item = isElement(node)
    ? processElement(node, parent, index)
    : processNode(node, parent, index);

  if (!item) return;

  //Bypass document Header.
  if (isElement(node) && node.getAttribute('_tag') === schemaManager.getHeader()) {
    return item;
  }

  const nodeChildren =
    isElement(node) && treeType === 'tag'
      ? Array.from(node.children)
      : Array.from(node.childNodes);

  nodeChildren.forEach((child, index) => {
    const childItem = getNodes({ index, level: level + 1, node: child, parent: item, treeType });
    if (childItem) item.children.push(childItem);
  });

  return item;
};

/**
 * It takes a Element and returns a treeItem object.
 * @param {Element} element - element node to process
 * @returns A treeItem object
 */
export const processElement = (element: Element, parent?: TreeItem, index = 0) => {
  const id = element.getAttribute('id') ?? element.getAttribute('name');
  const tagName = element.getAttribute('_tag');

  if (!id || !tagName) {
    log.info('markup panel: no id for', tagName);
    return;
  }

  const isEntity = !!element.getAttribute('_entity');
  const content = element.textContent ?? '';

  const xpathIndex = getXpathIndex(element, tagName);
  const xpathIndexSelector = xpathIndex > 1 ? `[${xpathIndex}]` : '';
  const xpath = parent ? `${parent.xpath}/${tagName}${xpathIndexSelector}` : `${tagName}`;

  const item: TreeItem = {
    id,
    children: [],
    content,
    isEntity,
    label: tagName,
    nodeIndex: index,
    parentId: parent?.id ?? null,
    parentName: parent?.label,
    type: 'tag',
    xpath,
  };

  return item;
};

/**
 * It takes a node and returns a treeItem object .
 * @param {Node} node - the node to process
 * @returns A treeItem object
 */
export const processNode = (node: Node, parent?: TreeItem, index = 0) => {
  // * remove comments to ignore nodes with tab and line-breaks
  // const trimmedContent = node.textContent.replaceAll(/\\n|\\t|\\r/g, '').trim();
  // if (trimmedContent === '') return;

  //* remove comments to ignore nodes without siblings
  // if (node.previousSibling === null && node.nextSibling === null) return null;

  const content = node.textContent ?? '';

  const xpathIndex = getXpathIndex(node, '#text');
  const xpathIndexSelector = `[${xpathIndex}]`;
  const xpath = `${parent?.xpath}/text()${xpathIndexSelector}`;

  const item: TreeItem = {
    id: xpath,
    children: [],
    content,
    label: '#text',
    type: 'text',
    nodeIndex: index,
    parentId: parent?.id ?? null,
    parentName: parent?.label,
    xpath,
  };

  return item;
};

/**
 * It returns the index of the given node in the list of nodes with the same name
 * @param {Node} node - The node to get the index of.
 * @param {string} nodeName - The name of the node.
 * @returns The index of the node in the parent node.
 */
const getXpathIndex = (node: Node, nodeName: string) => {
  let index = 1;
  for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
    if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue; // Ignore document type declaration.

    const siblingName = isElement(sibling) ? sibling.getAttribute('_tag') : sibling.nodeName;
    if (nodeName === siblingName) ++index;
  }
  return index;
};

interface MoveNodeParams {
  childIndex: number;
  dragId: UniqueIdentifier;
  dropId: UniqueIdentifier;
  position?: 'after' | 'before';
}

/**
 * It takes a `dragId` and a `dropId` and moves the node with the `dragId` into the node with the
 * `dropId`
 * @param {MoveNodeParams}  - `childIndex` is the index of the child node that the dragged node will be
 * dropped before or after.
 *   childIndex: number
 *   dragId: string
 *   dropId: string
 *   position: string
 */
export const moveNode = ({
  childIndex,
  dragId,
  dropId,
  position = 'after',
}: MoveNodeParams): void => {
  const { writer } = window;
  if (!writer.editor) return;

  const { schemaManager } = writer;

  const dragNodeEditor = writer.editor.getBody().querySelector(`#${dragId}`);
  const dropNodeEditor = writer.editor.getBody().querySelector(`#${dropId}`);

  if (!dropNodeEditor || !dragNodeEditor) return;
  if ([schemaManager.getRoot(), schemaManager.getHeader()].includes(dropNodeEditor.id)) {
    return;
  }

  //TODO
  // const parentNotes = parents(dragNodeEditor, '.noteWrapper');
  // if (parentNotes.length > 0) dragNodeEditor = parentNotes[0];

  //TODO
  // if (isCopy) dragNodeEditor = dragNodeEditor.cloneNode(true);

  if (childIndex === 0) {
    dropNodeEditor.prepend(dragNodeEditor);
  } else {
    const prevSibiling = dropNodeEditor.childNodes.item(childIndex);
    if (prevSibiling) {
      position === 'after'
        ? prevSibiling.after(dragNodeEditor)
        : prevSibiling.before(dragNodeEditor);
    } else {
      dropNodeEditor.prepend(dragNodeEditor);
    }
  }

  //TODO
  // if (isCopy) writer.tagger.processNewContent(dragNodeEditor as Element);

  writer.editor.undoManager.add();
  setTimeout(() => writer.event('contentChanged').publish(), 1000);
};
