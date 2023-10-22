import { UniqueIdentifier } from '@dnd-kit/core';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { log } from '../../../utilities';
import {
  displayTextNodesAtom,
  expandedItemsAtom,
  itemsAtom,
  nodeChangedAtom,
  selectedItemsAtom,
} from './store';
import type { FlattenedItem } from './types';

export const useEditor = (flattenedTree: FlattenedItem[]) => {
  const { writer } = window;

  const [nodeChanged, setNodeChanged] = useAtom(nodeChangedAtom);
  const [selectedItems, setSelectedItems] = useAtom(selectedItemsAtom);

  const items = useAtomValue(itemsAtom);
  const displayTextNodes = useAtomValue(displayTextNodesAtom);

  const setExpandedItems = useSetAtom(expandedItemsAtom);

  const [enabled, setEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);

  useEffect(() => {
    writer.event('documentLoaded').subscribe(handleDocumentLoaded);
    writer.event('selectionChanged').subscribe(handleSelectionChange);
    writer.event('contentChanged').subscribe(handleContentChanged);
    writer.event('nodeChanged').subscribe(handleNodeChange);
    writer.event('massUpdateStarted').subscribe(handleMassUpdateStarted);
    writer.event('massUpdateCompleted').subscribe(handleMassUpdateCompleted);

    writer.event('writerKeyup').subscribe(handleWriterKeyup);

    //? This events were listed in the previous version of the tree view. We may or may not need them.
    // writer.event('entityAdded').subscribe(update);
    // writer.event('entityPasted').subscribe(update);
    // writer.event('entityRemoved').subscribe(update);
    // writer.event('tagAdded').subscribe(update);
    // writer.event('tagEdited').subscribe(update);
    // writer.event('tagRemoved').subscribe(update);
    // writer.event('tagContentsRemoved').subscribe(update);
    // writer.event('tagSelected').subscribe(update);

    return () => {
      writer.event('documentLoaded').unsubscribe(handleDocumentLoaded);
      writer.event('selectionChanged').unsubscribe(handleSelectionChange);
      writer.event('contentChanged').unsubscribe(handleContentChanged);
      writer.event('nodeChanged').unsubscribe(handleNodeChange);
      writer.event('massUpdateStarted').unsubscribe(handleMassUpdateStarted);
      writer.event('massUpdateCompleted').unsubscribe(handleMassUpdateCompleted);
      writer.event('writerKeyup').unsubscribe(handleWriterKeyup);
    };
  }, [initialized, enabled, items]);

  useEffect(() => {
    if (nodeChanged) {
      if (selectedItems.includes(nodeChanged)) return;

      // const flatten = flattenedTree.length > 0 ? flattenedTree : flattenTree(items);
      const parents = getItemParents(nodeChanged);

      setExpandedItems((prev) => [...new Set([...prev, ...parents, nodeChanged])]);
      setSelectedItems([nodeChanged]);
    }
  }, [nodeChanged]);

  const handleDocumentLoaded = () => {
    setInitialized(true);
    setEnabled(true);
  };

  const handleWriterKeyup = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft'].includes(event.code)) {
      handleSelectionChange();
    }
  };

  const handleSelectionChange = () => {
    if (!writer.editor || !enabled) return;

    const rng = writer.editor.selection.getRng();
    if (rng.collapsed) {
      selectItem(rng);
      return;
    }

    //check if start / end ranges has common ancestry;
    const { schemaManager } = window.writer;
    let { startContainer, endContainer } = rng;

    while (startContainer.parentElement && endContainer.parentElement) {
      if (startContainer.parentElement.id === endContainer.parentElement.id) {
        break;
      }
      startContainer = startContainer.parentElement;
      endContainer = endContainer.parentElement;

      if (
        startContainer.parentElement?.id === schemaManager.getRoot() ||
        endContainer.parentElement?.id === schemaManager.getRoot()
      ) {
        break;
      }
    }

    if (
      !startContainer ||
      !endContainer ||
      startContainer.parentElement?.id !== endContainer.parentElement?.id
    ) {
      selectCommonAncestorItem(rng.commonAncestorContainer);
    } else {
      selectItems(startContainer, endContainer);
    }
  };

  const selectItem = (rng: Range) => {
    const anchorNode = displayTextNodes
      ? rng.commonAncestorContainer
      : rng.commonAncestorContainer.parentNode;

    if (!anchorNode) return;

    const xpath = writer.utilities.getNodeXpath(anchorNode);

    const item = flattenedTree.find((flat) => flat.xpath === xpath);
    if (!item) return;
    if (selectedItems.includes(item.id)) return;

    const parents = getItemParents(item.id);
    setExpandedItems((prev) => [...new Set([...prev, ...parents, item.id])]);
    setSelectedItems([item.id]);
  };

  const selectCommonAncestorItem = (node: Node) => {
    const xpath = writer.utilities.getNodeXpath(node);

    const item = flattenedTree.find((flat) => flat.xpath === xpath);
    if (!item) return;
    if (selectedItems.includes(item.id)) return;

    const parents = getItemParents(item.id);
    setExpandedItems((prev) => [...new Set([...prev, ...parents, item.id])]);
    setSelectedItems([item.id]);
  };

  const selectItems = (startContainer: Node, endContainer: Node) => {
    const startXpath = writer.utilities.getNodeXpath(startContainer);
    const endXpath = writer.utilities.getNodeXpath(endContainer);

    const startItem = flattenedTree.find((flat) => flat.xpath === startXpath);
    const endItem = flattenedTree.find((flat) => flat.xpath === endXpath);
    if (!startItem || !endItem) return;

    const parents = getItemParents(startItem.id);
    setExpandedItems((prev) => [...new Set([...prev, ...parents])]);

    const expandedSelection: UniqueIdentifier[] = [];

    const firstIndex = Math.min(startItem.index, endItem.index);
    const lastIndex = Math.max(startItem.index, endItem.index);

    for (let i = firstIndex; i <= lastIndex; i++) {
      const item = flattenedTree.find(
        ({ depth, index, parentId }) =>
          depth === startItem.depth && parentId === endItem.parentId && index === i
      );
      if (item) expandedSelection.push(item.id);
    }

    setSelectedItems(expandedSelection);
  };

  const getItemParents = (id: UniqueIdentifier) => {
    const parents: UniqueIdentifier[] = [];
    let parentId = flattenedTree.find((item) => item.id === id)?.parentId;
    if (!parentId) return [];

    while (parentId) {
      if (!parentId) break;
      parents.push(parentId);
      parentId = flattenedTree.find((item) => item.id === parentId)?.parentId;
    }

    return parents;
  };

  const handleContentChanged = () => {
    setTimeout(() => setUpdatePending(true), 1);
  };

  const handleMassUpdateStarted = () => setEnabled(false);
  const handleMassUpdateCompleted = () => setEnabled(true);

  const handleNodeChange = (node?: Element) => {
    if (!initialized) {
      handleDocumentLoaded();
      return;
    }
    if (!enabled) return;

    const id = node?.id;
    if (!id) {
      log.info(`markup panel: attribute 'id' missing from node ${node?.tagName}`);
      return;
    }

    setNodeChanged(id);
  };

  return {
    enabled,
    initialized,
    setUpdatePending,
    updatePending,
  };
};
