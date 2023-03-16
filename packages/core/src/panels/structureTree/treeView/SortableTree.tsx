import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAtomValue } from 'jotai';
import React, { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useActions } from '../../../overmind';
import { log } from '../../../utilities';
import { SortableTreeItem } from './components';
import {
  allowDNDAtom,
  allowMultiselectionAtom,
  displayTextNodeContentAtom,
  displayTextNodesAtom,
  preventDragAtom,
} from './store';
import type { SensorContext, TreeItems } from './types';
import { useTree } from './useTree';
import {
  adjustTranslate,
  dropAnimationConfig,
  flattenTree,
  getParents,
  getProjection,
  measuring,
} from './utilities';

const INDENTATION_WIDTH = 16;
const INTIATE_EXPANDED_UP_TO_LEVEL = 2;

export const SortableTree = () => {
  const { showContextMenu } = useActions().ui;
  const { writer } = window;

  const allowDND = useAtomValue(allowDNDAtom);
  const allowMultiselection = useAtomValue(allowMultiselectionAtom);
  const showTextNodes = useAtomValue(displayTextNodesAtom);
  const displayTextNodeContent = useAtomValue(displayTextNodeContentAtom);
  const preventDrag = useAtomValue(preventDragAtom);

  const { getEditorTreeModel, moveNode } = useTree();

  const [initialized, setInitialized] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);

  const [items, setItems] = useState<TreeItems>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const [selectedItems, setSelectedItems] = useState<UniqueIdentifier[]>([]);
  const [selectedItemsAnchor, setSelectedItemsAnchor] = useState<UniqueIdentifier>(null);
  const [expandedItems, setExpandedItems] = useState<UniqueIdentifier[]>([]);
  const [nodeChanged, setNodeChanged] = useState<UniqueIdentifier>(null);

  const _flattenTree = useMemo(() => flattenTree(items), [items]);

  const visibleTree = useMemo(() => {
    let cloneExpandedItems = [...expandedItems];

    if (!cloneExpandedItems.includes(items[0]?.id)) {
      cloneExpandedItems.unshift(items[0]?.id);
    }

    const visible = _flattenTree.filter(({ id, parentId, children }) => {
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

    return visible;
  }, [activeId, expandedItems, _flattenTree]);

  const projected =
    activeId && overId
      ? getProjection(visibleTree, activeId, overId, offsetLeft, INDENTATION_WIDTH)
      : null;

  const virtuoso = useRef<VirtuosoHandle>(null);

  const sensorContext: SensorContext = useRef({
    items: visibleTree,
    offset: offsetLeft,
    selectedItems: selectedItems,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
        tolerance: !allowDND || preventDrag ? 0 : undefined,
      },
    })
  );

  const sortedIds = useMemo(() => visibleTree.map(({ id }) => id), [visibleTree]);
  const activeItem = activeId ? visibleTree.find(({ id }) => id === activeId) : null;

  useEffect(() => {
    writer.event('documentLoaded').subscribe(initialize);
    writer.event('nodeChanged').subscribe(nodeChange);
    writer.event('contentChanged').subscribe(contentChanged);

    //? This events were listed in the previous version of the tree view. We may or may not need them.
    // writer.event('entityAdded').subscribe(update);
    // writer.event('entityPasted').subscribe(update);
    // writer.event('entityRemoved').subscribe(update);
    // writer.event('massUpdateStarted').subscribe(() => setEnabled(false));
    // writer.event('massUpdateCompleted').subscribe(() => setEnabled(true));
    // writer.event('tagAdded').subscribe(update);
    // writer.event('tagEdited').subscribe(update);
    // writer.event('tagRemoved').subscribe(update);
    // writer.event('tagContentsRemoved').subscribe(update);
    // writer.event('tagSelected').subscribe(update);

    return () => {
      writer.event('documentLoaded').unsubscribe(initialize);
      writer.event('nodeChanged').unsubscribe(nodeChange);
      writer.event('contentChanged').unsubscribe(contentChanged);
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
    sensorContext.current = {
      items: visibleTree,
      offset: offsetLeft,
    };
  }, [visibleTree, offsetLeft, items, selectedItems]);

  useEffect(() => {
    if (updatePending) {
      const treeModel = getEditorTreeModel();
      setItems(treeModel);
      setUpdatePending(false);
    }
  }, [updatePending]);

  useEffect(() => {
    if (initialized) {
      let treeModel = getEditorTreeModel();
      setItems(treeModel);
    }
  }, [showTextNodes, displayTextNodeContent]);

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
      if (selectedItems === null || selectedItems.length === 0) setSelectedItemsAnchor(null);
      const selectedItemIndex = visibleTree.findIndex(({ id }) => id === selectedItems[0]);

      if (selectedItemIndex) {
        virtuoso?.current?.scrollIntoView({
          index: selectedItemIndex,
          align: 'center',
          behavior: 'smooth',
        });
      }
    }, 1);
  }, [selectedItems[0]]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!!overId && overId !== activeId) {
      let _overId = overId;
      timer = setTimeout(() => {
        if (_overId == overId) handleExpand(_overId, true);
      }, 1000);
    } else {
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [overId]);

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
      log.info(`markup panel: attribute 'id' missing from node ${node}`);
      return;
    }

    setNodeChanged(id);
  };

  const contentChanged = () => {
    setTimeout(() => setUpdatePending(true), 1);
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

  const expandUpTo = (treeModel: TreeItems, depth: number = Infinity) => {
    const flatten = _flattenTree.length > 0 ? _flattenTree : flattenTree(treeModel);
    const itemsToExpand = flatten.filter((item) => item.depth < depth).map((item) => item.id);
    setExpandedItems(itemsToExpand);
  };

  const handSelectItem = (
    event: MouseEvent<HTMLElement, Event>,
    { id, contentOnly = true }: { id: string; contentOnly?: boolean }
  ) => {
    if (!allowMultiselection || !event.shiftKey) {
      setSelectedItems([id]);
      setSelectedItemsAnchor(id);
      writer.utilities.selectElementById(id, contentOnly);
      return;
    }

    //* Holding Shift key
    //* expand selection from first to last
    if (!canAddToMultiselection(id)) return;

    const target = visibleTree.find((item) => item.id === id);
    const anchor = visibleTree.find((item) => item.id === selectedItemsAnchor);

    const expandedSelection: UniqueIdentifier[] = [];

    let firstIndex = Math.min(anchor.index, target.index);
    let lastIndex = Math.max(anchor.index, target.index);

    for (let i = firstIndex; i <= lastIndex; i++) {
      const item = visibleTree.find(
        ({ depth, index, parentId }) =>
          depth === anchor.depth && parentId === anchor.parentId && index === i
      );
      if (item) expandedSelection.push(item.id);
    }

    setSelectedItems(expandedSelection);
    writer.utilities.selectElementById(expandedSelection as string[], contentOnly);
  };

  const canAddToMultiselection = (id: UniqueIdentifier) => {
    if (selectedItems.includes(id)) return true;
    if (selectedItems.length === 0) return true;

    const target = visibleTree.find((item) => item.id === id);
    const anchor = visibleTree.find((item) => item.id === selectedItemsAnchor);

    if (anchor.parentId !== target.parentId) return false;

    return true;
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement, Event>, id: string) => {
    let tagIds: string | string[] = id;

    if (!selectedItems.includes(id) || selectedItems.length === 1) {
      handSelectItem(event, { id, contentOnly: true });
    }

    if (selectedItems.length > 1) {
      tagIds = sortByIndex(selectedItems) as string[];
      writer.utilities.selectElementById(tagIds[0], true);
    }

    const allowsMerge = () => {
      if (!Array.isArray(tagIds)) return false;
      const anchor = visibleTree.find(({ id }) => id === selectedItemsAnchor);
      return tagIds.every(
        (tagId) => visibleTree.find(({ id }) => id === tagId)?.label === anchor?.label
      );
    };

    showContextMenu({
      show: true,
      allowsMerge: allowsMerge(),
      count: Array.isArray(tagIds) ? tagIds.length : undefined,
      eventSource: 'structureTree',
      position: { posX: event.clientX, posY: event.clientY },
      tagId: tagIds,
      useSelection: false,
    });
  };

  const sortByIndex = (tags: UniqueIdentifier[]) => {
    const list = tags.sort((a, b) => {
      const tagA = visibleTree.find((item) => item.id === a);
      const tagB = visibleTree.find((item) => item.id === b);
      if (tagA.index < tagB.index) return -1;
      if (tagA.index > tagB.index) return 1;
      return 0;
    });
    return list;
  };

  const shouldBeDraggable = (label: string) => {
    if (label === writer.schemaManager.getRoot()) return false;
    if (label === writer.schemaManager.getHeader()) return false;
    return true;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const {
      active: { id: activeId },
    } = event;
    setActiveId(activeId);
    setOverId(activeId);
    setSelectedItems([]);

    document.body.style.setProperty('cursor', 'grabbing');
  };

  const handleDragMove = ({ delta, over }: DragMoveEvent) => {
    if (over) {
      const overIndex = visibleTree.findIndex(({ id }) => id === over.id);
      const overItem = visibleTree[overIndex];
      if (overItem.type === 'node') return;
    }

    setOffsetLeft(delta.x);
  };

  const handleDragOver = ({ delta, collisions, over }: DragOverEvent) => {
    setOverId(over?.id ?? null);
  };

  const handleDragEnd = ({ active, delta, over }: DragEndEvent) => {
    resetState();

    if (projected && over) {
      const { depth, parentId } = projected;

      const parentIndex = visibleTree.findIndex(({ id }) => id === parentId);
      if (visibleTree[parentIndex].type === 'node') return;

      // const overIndex = flattenedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = visibleTree.findIndex(({ id }) => id === active.id);
      const overIndexParent = visibleTree[parentIndex].children.findIndex(
        ({ id }) => id === over.id
      );
      // const activeTreeItem = flattenedItems[activeIndex];

      const position = delta.y >= 0 ? 'after' : 'before';

      if (overIndexParent < 0) return;

      moveNode({ childIndex: overIndexParent, dragId: active.id, dropId: parentId, position });
    }
  };

  const handleDragCancel = () => {
    resetState();
  };

  const resetState = () => {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);

    document.body.style.setProperty('cursor', '');
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      sensors={sensors}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        <Virtuoso
          ref={virtuoso}
          overscan={1000}
          data={visibleTree}
          itemContent={(index, { id, children, isEntity, depth, label, type }) => {
            return (
              <SortableTreeItem
                key={id}
                canAddToMultiselection={canAddToMultiselection}
                depth={id === activeId && projected ? projected.depth : depth}
                disableInteraction={type === 'node'}
                // disableSelection={true}
                draggable={shouldBeDraggable(label)}
                expanded={expandedItems.includes(id)}
                expandDisabled={label === writer.schemaManager.getRoot()}
                id={id}
                indentationWidth={INDENTATION_WIDTH}
                isEntity={isEntity}
                label={label}
                multipleSelection={selectedItems.length > 1}
                nodeId={id.toString()}
                onContextMenuOpen={handleContextMenu}
                onExpand={
                  children.length ? () => handleExpand(id, !expandedItems.includes(id)) : undefined
                }
                onSelectItem={handSelectItem}
                selected={selectedItems.includes(id)}
                type={type}
              />
            );
          }}
          style={{ height: '100%' }}
        />
        {createPortal(
          <DragOverlay dropAnimation={dropAnimationConfig} modifiers={[adjustTranslate]}>
            {activeId && activeItem ? (
              <SortableTreeItem
                id={activeId}
                clone
                depth={activeItem.depth}
                indentationWidth={INDENTATION_WIDTH}
                isEntity={activeItem.isEntity}
                label={activeItem.label}
                nodeId={activeId.toString()}
                type={activeItem.type}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </SortableContext>
    </DndContext>
  );
};
