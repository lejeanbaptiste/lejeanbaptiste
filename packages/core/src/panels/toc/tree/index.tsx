import { UniqueIdentifier } from '@dnd-kit/core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Item } from './Item';
import { useTree, type TreeItem } from './useTree';

const INDENTATION_WIDTH = 16;
const INTIATE_EXPANDED_UP_TO_LEVEL = 4;

export const Tree = () => {
  const virtuoso = useRef<VirtuosoHandle>(null);
  const { writer } = window;

  const { getEditorTreeModel, flattenTree, getParents } = useTree();

  const [initialized, setInitialized] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);

  const [selectedItems, setSelectedItems] = useState<UniqueIdentifier[]>([]);
  const [expandedItems, setExpandedItems] = useState<UniqueIdentifier[]>([]);
  const [nodeChanged, setNodeChanged] = useState<UniqueIdentifier>(null);

  const [items, setItems] = useState<TreeItem[]>([]);

  const _flattenTree = useMemo(() => flattenTree(items), [items]);

  const flattenedItems = useMemo(() => {
    const flattenedTree = [..._flattenTree];

    let cloneExpandedItems = [...expandedItems];

    if (!cloneExpandedItems.includes(items[0]?.id)) {
      cloneExpandedItems.unshift(items[0]?.id);
    }

    let visibleTree = flattenedTree.filter(({ id, parentId, children }) => {
      const shouldShow = cloneExpandedItems.includes(id);
      if (!shouldShow) {
        const childrenId = children.map((child) => child.id);
        childrenId.forEach(
          (id) => (cloneExpandedItems = cloneExpandedItems.filter((exp) => exp !== id))
        );
        return cloneExpandedItems.includes(parentId);
      }
      return shouldShow;
    });

    visibleTree = visibleTree.slice(1, visibleTree.length);

    return visibleTree;
  }, [expandedItems, _flattenTree]);

  useEffect(() => {
    writer.event('documentLoaded').subscribe(initialize);
    writer.event('nodeChanged').subscribe(nodeChange);

    return () => {
      writer.event('documentLoaded').unsubscribe(initialize);
      writer.event('nodeChanged').unsubscribe(nodeChange);
    };
  }, [initialized, enabled, updatePending]);

  useEffect(() => {
    if (initialized) {
      let treeModel = getEditorTreeModel();
      expandUpTo(treeModel, INTIATE_EXPANDED_UP_TO_LEVEL);
      setItems(treeModel);
    }
  }, [initialized]);

  useEffect(() => {
    if (updatePending) {
      const treeModel = getEditorTreeModel();
      setItems(treeModel);
      setUpdatePending(false);
    }
  }, [updatePending]);

  useEffect(() => {
    if (!!nodeChanged) {
      if (selectedItems.includes(nodeChanged)) return;

      const flatten = _flattenTree.length > 0 ? _flattenTree : flattenTree(items);
      const parents = getParents(flatten, nodeChanged);

      setExpandedItems((prev) => [...new Set([...prev, ...parents, nodeChanged])]);
      setSelectedItems([nodeChanged]);
    }
  }, [nodeChanged]);

  useEffect(() => {
    setTimeout(() => {
      const selectedItemIndex = flattenedItems.findIndex(({ id }) => id === selectedItems[0]);
      if (selectedItemIndex) {
        virtuoso?.current?.scrollIntoView({
          index: selectedItemIndex,
          align: 'center',
          behavior: 'smooth',
        });
      }
    }, 1);
  }, [selectedItems[0]]);

  const initialize = () => {
    setInitialized(true);
    setEnabled(true);
  };

  const nodeChange = (node?: Element) => {
    if (!initialized) {
      initialize();
      return;
    }

    const id = node.id;
    if (!id) {
      console.warn(`Structure Tree: Attribute 'id' missing from node ${node}`);
      return;
    }

    setNodeChanged(id);
  };

  const expandUpTo = (treeModel: TreeItem[], depth: number = Infinity) => {
    const flatten = _flattenTree.length > 0 ? _flattenTree : flattenTree(treeModel);
    const itemsToExpand = flatten.filter((item) => item.depth < depth).map((item) => item.id);
    setExpandedItems(itemsToExpand);
  };

  const handSelectItem = (id: string) => {
    setSelectedItems([id]);
    writer.utilities.selectElementById(id, true);
  };

  const handleExpand = (id: UniqueIdentifier, value: boolean) => {
    if (value === true) {
      setExpandedItems((prev) => {
        const newValues = new Set([...prev, id]);
        return [...newValues];
      });
      return;
    }

    if (value === false) {
      setExpandedItems((prev) => prev.filter((itemId) => itemId !== id));
      return;
    }
  };

  return (
    <Virtuoso
      ref={virtuoso}
      overscan={1000}
      data={flattenedItems}
      itemContent={(index, { id, children, depth, label, content }) => {
        return (
          <Item
            key={id}
            content={content}
            depth={depth - 1} //top level is hidden
            expanded={expandedItems.includes(id)}
            expandDisabled={label === writer.schemaManager.getRoot()}
            indentationWidth={INDENTATION_WIDTH}
            label={label}
            nodeId={id.toString()}
            onExpand={
              children.length ? () => handleExpand(id, !expandedItems.includes(id)) : undefined
            }
            onSelectItem={handSelectItem}
            selected={selectedItems.includes(id)}
          />
        );
      }}
      style={{ height: '100%' }}
    />
  );
};
