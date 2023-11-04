import { UniqueIdentifier } from '@dnd-kit/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { log } from '../../../utilities';
import { Item } from './Item';
import { useTree, type FlattenedItem } from './useTree';

const INDENTATION_WIDTH = 16;
const INTIATE_EXPANDED_UP_TO_LEVEL = 2;

export const Tree = () => {
  const virtuoso = useRef<VirtuosoHandle>(null);
  const { writer } = window;

  const { getEditorTreeModel, getParents } = useTree();

  const [initialized, setInitialized] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);

  const [flattenTree, setFlattenTree] = useState<FlattenedItem[]>([]);

  const [selectedItem, setSelectedItem] = useState<UniqueIdentifier | null>(null);
  const [expandedItems, setExpandedItems] = useState<UniqueIdentifier[]>([]);
  const [nodeChanged, setNodeChanged] = useState<UniqueIdentifier | null>(null);

  const visibleTree = useMemo(() => {
    let cloneExpandedItems = [...expandedItems];

    if (flattenTree[0]?.id && !cloneExpandedItems.includes(flattenTree[0]?.id)) {
      cloneExpandedItems.unshift(flattenTree[0]?.id);
    }

    let visible = flattenTree.filter(({ id, parentId, children }) => {
      const shouldShow = cloneExpandedItems.includes(id);
      if (!shouldShow) {
        const childrenId = children.map((child) => child.id);
        childrenId.forEach(
          (id) => (cloneExpandedItems = cloneExpandedItems.filter((exp) => exp !== id)),
        );
        return parentId && cloneExpandedItems.includes(parentId);
      }
      return shouldShow;
    });

    //remove root
    visible = visible.slice(1, visible.length);

    return visible;
  }, [expandedItems, flattenTree]);

  useEffect(() => {
    writer.event('documentLoaded').subscribe(initialize);
    writer.event('nodeChanged').subscribe(nodeChange);

    return () => {
      writer.event('documentLoaded').unsubscribe(initialize);
      writer.event('nodeChanged').unsubscribe(nodeChange);
    };
  }, [initialized, updatePending]);

  useEffect(() => {
    if (initialized) {
      const treeModel = getEditorTreeModel();
      if (!treeModel) return;

      expandUpTo(treeModel, INTIATE_EXPANDED_UP_TO_LEVEL);
      setFlattenTree(treeModel);
    }
  }, [initialized]);

  useEffect(() => {
    if (updatePending) {
      const treeModel = getEditorTreeModel();
      if (!treeModel) return;

      setFlattenTree(treeModel);
      setUpdatePending(false);
    }
  }, [updatePending]);

  useEffect(() => {
    if (!!nodeChanged) {
      if (selectedItem === nodeChanged) return;
      const parents = getParents(flattenTree, nodeChanged);
      setExpandedItems((prev) => [...new Set([...prev, ...parents, nodeChanged])]);
      setSelectedItem(nodeChanged);
    }
  }, [nodeChanged]);

  useEffect(() => {
    setTimeout(() => {
      const selectedItemIndex = visibleTree.findIndex(({ id }) => id === selectedItem);
      if (selectedItemIndex) {
        virtuoso?.current?.scrollIntoView({
          index: selectedItemIndex,
          align: 'center',
          behavior: 'smooth',
        });
      }
    }, 1);
  }, [selectedItem]);

  const initialize = () => setInitialized(true);

  const nodeChange = (node?: Element) => {
    if (!initialized) {
      initialize();
      return;
    }

    const id = node?.id;
    if (!id) {
      log.info(`TOC: attribute 'id' missing from node ${node}`);
      return;
    }

    setNodeChanged(id);
  };

  const expandUpTo = (treeModel: FlattenedItem[], depth: number = Infinity) => {
    const itemsToExpand = treeModel.filter((item) => item.depth < depth).map((item) => item.id);
    setExpandedItems(itemsToExpand);
  };

  const handSelectItem = (id: string) => {
    setSelectedItem(id);
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
      data={visibleTree}
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
            selected={selectedItem === id}
          />
        );
      }}
      style={{ height: '100%' }}
    />
  );
};
