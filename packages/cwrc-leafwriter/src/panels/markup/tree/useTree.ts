import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';
import { displayTextNodesAtom, expandedItemsAtom, itemsAtom } from './store';
import type { TreeItems } from './types';
import { useEditor } from './useEditor';
import type { MarkupTreeSyncMode } from '../../../overmind/ui/state';
import { flattenTree, getNodes, processElement } from './utilities';

const INTIATE_EXPANDED_UP_TO_LEVEL = 4; //2;

export const useTree = (syncMode: Exclude<MarkupTreeSyncMode, 'off'>, refreshVersion: number) => {
  const [items, setItems] = useAtom(itemsAtom);
  const flattenedTree = useMemo(() => flattenTree(items), [items]);

  const [expandedItems, setExpandedItems] = useAtom(expandedItemsAtom);

  const displayTextNodes = useAtomValue(displayTextNodesAtom);

  const { initialized, setUpdatePending, updatePending } = useEditor(flattenedTree, syncMode);

  const visibleTree = useMemo(() => {
    const expanded = new Set(expandedItems);
    if (items[0]?.id) expanded.add(items[0].id);

    const visibleIds = new Set<(typeof flattenedTree)[number]['id']>();
    const visible: typeof flattenedTree = [];

    for (const item of flattenedTree) {
      const parentIsVisible =
        item.parentId === null || (visibleIds.has(item.parentId) && expanded.has(item.parentId));
      if (!parentIsVisible) continue;

      visible.push(item);
      visibleIds.add(item.id);
    }

    return visible;
  }, [expandedItems, flattenedTree, items]);

  useEffect(() => {
    if (initialized) {
      const treeModel = getEditorTreeModel();
      if (!treeModel) return;
      expandUpTo(treeModel, INTIATE_EXPANDED_UP_TO_LEVEL);
      setItems(treeModel);
    }
    // `getEditorTreeModel` and `expandUpTo` are declared below this effect, and a
    // dependency array is evaluated during render, so naming them would be a
    // temporal-dead-zone ReferenceError. They are also redefined every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  useEffect(() => {
    if (!initialized || refreshVersion === 0) return;
    const treeModel = getEditorTreeModel();
    if (!treeModel) return;
    setItems(treeModel);
    expandUpTo(treeModel, INTIATE_EXPANDED_UP_TO_LEVEL);
    // Same as above: the helpers are declared below, so naming them would be a
    // temporal-dead-zone reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, refreshVersion]);

  useEffect(() => {
    if (!updatePending) return;

    let cancelled = false;
    let attempts = 0;

    // The converter clears and rebuilds TinyMCE asynchronously. If the first
    // refresh runs between those steps, keep trying instead of leaving the old
    // tree displayed indefinitely.
    const refresh = () => {
      if (cancelled) return;

      const treeModel = getEditorTreeModel();
      if (treeModel) {
        setItems(treeModel);
        expandUpTo(treeModel, INTIATE_EXPANDED_UP_TO_LEVEL);
        setUpdatePending(false);
        return;
      }

      if (attempts++ < 30) {
        window.requestAnimationFrame(refresh);
      } else {
        setUpdatePending(false);
      }
    };

    const frame = window.requestAnimationFrame(refresh);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
    // Same as above: the helpers are declared below, so naming them would be a
    // temporal-dead-zone reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePending]);

  useEffect(() => {
    if (initialized) {
      const treeModel = getEditorTreeModel();
      if (!treeModel) return;

      setItems(treeModel);
    }
    // Rebuilds when the text-node display toggle changes. `initialized` is read
    // only as a guard, and the helpers are declared below this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    });

    if (!treeModel) return;

    return [treeModel];
  };

  const expandUpTo = (treeModel: TreeItems, depth = Infinity) => {
    // If update is running, rebuild tree in any case, since the automatic rebuild will not have run yet.
    const flatten =
      flattenedTree.length > 0
        ? updatePending
          ? flattenTree(treeModel)
          : flattenedTree
        : flattenTree(treeModel);
    const itemsToExpand = flatten
      .filter((item) => item.type === 'tag' && item.depth < depth)
      .map((item) => item.id);
    setExpandedItems(itemsToExpand);
  };

  return {
    visibleTree,
  };
};
