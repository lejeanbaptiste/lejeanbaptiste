import { type UniqueIdentifier } from '@dnd-kit/core';

export interface TreeItem {
  id: UniqueIdentifier;
  label: string;
  content?: string;
  children: TreeItem[];
}

interface FlattenedItem extends TreeItem {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

export const useTree = () => {
  const getEditorTreeModel = () => {
    if (!window.writer) return null;

    const { editor, schemaManager } = window.writer;

    let treeModel: TreeItem;

    const documentRootNode =
      editor.getBody().querySelector(`[_tag="${schemaManager.getRoot()}"]`) ??
      editor.getBody().querySelector('[_tag]');

    const rootItem = processElement(documentRootNode);
    if (!rootItem) return;

    treeModel = getElements({ element: documentRootNode });

    return [treeModel];
  };

  type GetNodesParams = {
    element: Element;
    level?: number;
    parent?: TreeItem;
  };

  /**
   * It takes a DOM element and returns a tree item
   * @param {GetItemsParams}  - an object with the following properties:
   * - `element` - the element to process
   * - `level` - the tree level
   * - `parent` - the tree item parent
   *
   * @returns A TreeItem with children.
   */
  const getElements = ({ element, level = 0, parent }: GetNodesParams): TreeItem => {
    const { schemaManager } = window.writer;

    const item = processElement(element);

    //Bypass document Header. Avoid children on 'edit' and completely on 'readonly'
    if (element.getAttribute('_tag') === schemaManager.getHeader()) return;

    let treeChildren: TreeItem[] = [];

    const elementChildren = Array.from(element.children);

    if (item && parent) {
      parent.children = [...parent.children, item];
    }

    elementChildren.forEach((child) => {
      const childItem = getElements({ element: child, level: level + 1, parent: item ?? parent });
      if (childItem) treeChildren.push(childItem);
    });

    //store children
    if (treeChildren.length > 0) {
      if (item) {
        item.children = treeChildren;
      } else {
        //flat into parent if item is undefined
        parent.children = [...parent.children, ...treeChildren];
        parent.children = [...new Set([...parent.children])]; // deduplicate
      }
    }

    return item;
  };

  /**
   * It takes a element and returns a treeItem object
   * @param {Element} element - the element to process
   * @returns A treeItem object
   */
  const processElement = (element: Element) => {
    const { schemaManager, utilities } = window.writer;

    const id = element.getAttribute('id') ?? element.getAttribute('name');
    const tag = element.getAttribute('_tag');

    if (!id) {
      console.warn('TOC: no id for', tag);
      return;
    }

    if (tag !== schemaManager.getRoot() && !schemaManager.mapper.getHeadingTags().includes(tag)) {
      return;
    }

    const constent =
      tag === schemaManager.getRoot() ? tag : element.textContent.trim();

    const item: TreeItem = {
      id,
      label: tag,
      content: constent,
      children: [],
    };

    return item;
  };

  function flatten(
    items: TreeItem[],
    parentId: UniqueIdentifier | null = null,
    depth = 0
  ): FlattenedItem[] {
    return items.reduce<FlattenedItem[]>((acc, item, index) => {
      return [
        ...acc,
        { ...item, parentId, depth, index },
        ...flatten(item?.children, item.id, depth + 1),
      ];
    }, []);
  }

  const flattenTree = (items: TreeItem[]): FlattenedItem[] => flatten(items);

  const getParents = (flatten: FlattenedItem[], id: UniqueIdentifier) => {
    const parents: UniqueIdentifier[] = [];
    let parentId = flatten.find((item) => item.id === id)?.parentId;
    if (!parentId) return [];

    while (parentId) {
      if (!parentId) break;
      parents.push(parentId);
      parentId = flatten.find((item) => item.id === parentId)?.parentId;
    }

    return parents;
  };

  return {
    flattenTree,
    getParents,
    getEditorTreeModel,
  };
};
