import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';
import { activeIdAtom, displayTextNodesAtom, expandedItemsAtom, itemsAtom } from './store';
import type { TreeItems } from './types';
import { useEditor } from './useEditor';
import { flattenTree, getNodes, processElement } from './utilities';

const INTIATE_EXPANDED_UP_TO_LEVEL = 4; //2;

export const useTree = () => {
  const [items, setItems] = useAtom(itemsAtom);
  const flattenedTree = useMemo(() => flattenTree(items), [items]);

  const [expandedItems, setExpandedItems] = useAtom(expandedItemsAtom);

  const activeId = useAtomValue(activeIdAtom);
  const displayTextNodes = useAtomValue(displayTextNodesAtom);

  const { initialized, setUpdatePending, updatePending } = useEditor(flattenedTree);

  const visibleTree = useMemo(() => {
    let cloneExpandedItems = [...expandedItems];

    if (items[0]?.id && !cloneExpandedItems.includes(items[0].id)) {
      cloneExpandedItems.unshift(items[0]?.id);
    }

    const visible = flattenedTree.filter(({ id, parentId, children }) => {
      const shouldShow = cloneExpandedItems.includes(id);
      if (!shouldShow) {
        const childrenIds = children.map((child) => child.id);
        childrenIds.forEach(
          (childId) =>
            (cloneExpandedItems = cloneExpandedItems.filter(
              (expandedItemId) => expandedItemId !== childId,
            )),
        );
        return parentId && cloneExpandedItems.includes(parentId);
      }
      return shouldShow;
    });

    return visible;
  }, [activeId, expandedItems, flattenedTree]);

  useEffect(() => {
    if (initialized) {
      const treeModel = getEditorTreeModel();
      if (!treeModel) return;
      expandUpTo(treeModel, INTIATE_EXPANDED_UP_TO_LEVEL);
      setItems(treeModel);
    }
  }, [initialized]);

  useEffect(() => {
    if (updatePending) {
      const treeModel = getEditorTreeModel();
      if (!treeModel) return;

      setItems(treeModel);
      setUpdatePending(false);
    }
  }, [updatePending]);

  useEffect(() => {
    if (initialized) {
      const treeModel = getEditorTreeModel();
      if (!treeModel) return;

      setItems(treeModel);
    }
  }, [displayTextNodes]);

  const getEditorTreeModel = () => {
    if (!window.writer.editor) return;

    const { editor, schemaManager } = window.writer;

    const documentRootNode =
      editor.getBody().querySelector(`[_tag="${schemaManager.getRoot()}"]`) ??
      editor.getBody().querySelector('[_tag]');

    if (!documentRootNode) return;

    const rootItem = processElement(documentRootNode);
    if (!rootItem) return;

    const treeModel = getNodes({
      node: documentRootNode,
      treeType: displayTextNodes ? 'text' : 'tag',
      xpath: '',
    });

    if (!treeModel) return;

    return [treeModel];
  };

  const expandUpTo = (treeModel: TreeItems, depth = Infinity) => {
    const flatten = flattenedTree.length > 0 ? flattenedTree : flattenTree(treeModel);
    const itemsToExpand = flatten
      .filter((item) => item.type === 'tag' && item.depth < depth)
      .map((item) => item.id);
    setExpandedItems(itemsToExpand);
  };

  return {
    visibleTree,
  };
};
