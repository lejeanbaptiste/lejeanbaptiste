import { type UniqueIdentifier } from '@dnd-kit/core';
import { log } from '../../../utilities';

export interface TreeItem {
  content: string;
  children: TreeItem[];
  id: UniqueIdentifier;
  isHeading: boolean;
  label: string;
  level: number;
}

export interface FlattenedItem extends TreeItem {
  depth: number;
  index: number;
  parentId: UniqueIdentifier | null;
}

type TraverseTreeParams = {
  element: Element;
  headings: TreeItem[];
  level?: number;
};

export const useTree = () => {
  const getEditorTreeModel = () => {
    if (!window.writer) return null;
    const { editor, schemaManager } = window.writer;

    const documentRootNode =
      editor?.getBody().querySelector(`[_tag="${schemaManager.getRoot()}"]`) ??
      editor?.getBody().querySelector('[_tag]');
    if (!documentRootNode) return;

    const rootItem = getHeading(documentRootNode);
    if (!rootItem) return;

    const headings: TreeItem[] = [];

    traverseTree({ element: documentRootNode, headings });

    const parsedHeading = parseHeading(headings);

    return parsedHeading;
  };

  const parseHeading = (headings: TreeItem[]) => {
    //dedup and sort levels
    const levels = [...new Set(headings.map((heading) => heading.level))].sort();

    //map levels into depth
    const depthLevelMapping: Map<number, number> = new Map();
    levels.forEach((level) => {
      if (depthLevelMapping.has(level)) return;
      depthLevelMapping.set(level, depthLevelMapping.size);
    });

    //Assign depth based on level for each heading
    let parsedHeadings = headings.map((heading, index) => {
      const depth = depthLevelMapping.get(heading.level) ?? 0;
      const item: FlattenedItem = {
        ...heading,
        depth,
        parentId: null,
        index,
      };
      return item;
    });

    //establish parent/children relationship
    parsedHeadings = parsedHeadings.map((heading, index) => {
      const parent = getHeadingParent(parsedHeadings, index, heading.depth);
      const parentId = parent?.id ?? null;
      if (parent) parent.children.push(heading);

      return {
        ...heading,
        parentId,
      };
    });

    return parsedHeadings;
  };

  const getHeadingParent = (headings: FlattenedItem[], fromIndex: number, depth: number) => {
    const headingsClone = [...headings].slice(0, fromIndex).reverse();
    for (const heading of headingsClone) {
      if (heading.depth < depth) return heading;
    }
    return null;
  };

  /**
   * It takes an element, and recursively traverses its children, collecting headings and their levels
   * @param {TraverseTreeParams}  - TraverseTreeParams
   * @returns a TreeItem
   */
  const traverseTree = ({ element, headings, level = 0 }: TraverseTreeParams) => {
    const { schemaManager } = window.writer;

    //Bypass document Header. Avoid children on 'edit' and completely on 'readonly'
    if (element.getAttribute('_tag') === schemaManager.getHeader()) return;

    //collect heading
    const item = getHeading(element);
    if (item) {
      item.level = level;
      headings.push(item as TreeItem);
    }

    Array.from(element.children).forEach((child) => {
      traverseTree({ element: child, headings, level: level + 1 });
    });

    return item;
  };

  /**
   * It takes a element and returns a treeItem object if the tag is a 'heading'
   * @param {Element} element - the element to process
   * @returns A treeItem object
   */
  const getHeading = (element: Element) => {
    const { schemaManager } = window.writer;

    const id = element.getAttribute('id') ?? element.getAttribute('name');
    const tag = element.getAttribute('_tag');

    if (!id || !tag) {
      log.info('TOC: no id for', tag);
      return;
    }

    const isHeading = schemaManager.mapper.getHeadingTags().includes(tag);

    if (tag !== schemaManager.getRoot() && !isHeading) return;

    const constent =
      tag === schemaManager.getRoot() || !isHeading ? tag : element.textContent?.trim();

    const item: Partial<TreeItem> = {
      content: constent ?? '',
      children: [],
      id,
      isHeading,
      label: tag,
    };

    return item;
  };

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
    getParents,
    getEditorTreeModel,
  };
};
