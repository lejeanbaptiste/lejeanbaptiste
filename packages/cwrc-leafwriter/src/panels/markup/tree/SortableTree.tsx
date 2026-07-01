import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAtom, useAtomValue } from 'jotai';
import { KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useActions } from '../../../overmind';
import { SortableTreeItem } from './components';
import {
  activeIdAtom,
  allowDndAtom,
  expandedItemsAtom,
  itemsAtom,
  selectedItemsAtom,
} from './store';
import type { SensorContext } from './types';
import { useTree } from './useTree';
import {
  adjustTranslate,
  dropAnimationConfig,
  getProjection,
  measuring,
  moveNode,
} from './utilities';

const INDENTATION_WIDTH = 16;

export const SortableTree = () => {
  const { writer } = window;

  const { showContextMenu } = useActions().ui;

  const [activeId, setActiveId] = useAtom(activeIdAtom);
  const [selectedItems, setSelectedItems] = useAtom(selectedItemsAtom);
  const [expandedItems, setExpandedItems] = useAtom(expandedItemsAtom);

  const allowDnd = useAtomValue(allowDndAtom);
  const items = useAtomValue(itemsAtom);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
        tolerance: !allowDnd ? 0 : undefined,
      },
    }),
  );

  const [offsetLeft, setOffsetLeft] = useState(0);
  const [multiselectAnchor, setMultiselectAnchor] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

  const { visibleTree } = useTree();

  const sortedIds = useMemo(() => visibleTree.map(({ id }) => id), [visibleTree]);

  const sensorContext: SensorContext = useRef({
    items: visibleTree,
    offset: offsetLeft,
    selectedItems: selectedItems,
  });

  const virtuoso = useRef<VirtuosoHandle>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const activeItem = activeId ? visibleTree.find(({ id }) => id === activeId) : null;

  const projected =
    activeId && overId
      ? getProjection(visibleTree, activeId, overId, offsetLeft, INDENTATION_WIDTH)
      : null;

  useEffect(() => {
    sensorContext.current = {
      items: visibleTree,
      offset: offsetLeft,
    };
  }, [items, offsetLeft, selectedItems, visibleTree]);

  useEffect(() => {
    setTimeout(() => {
      if (selectedItems === null || selectedItems.length === 0) setMultiselectAnchor(null);
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
    let timer: NodeJS.Timeout | undefined;
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

  const canAddToMultiselection = (id: UniqueIdentifier) => {
    if (selectedItems.includes(id)) return true;
    if (selectedItems.length === 0) return true;

    const target = visibleTree.find((item) => item.id === id);
    const anchor = visibleTree.find((item) => item.id === multiselectAnchor);

    if (anchor?.parentId !== target?.parentId) return false;

    return true;
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

  const handleSelectItem = (
    event: MouseEvent<HTMLElement, Event>,
    { id, contentOnly = true }: { id: UniqueIdentifier; contentOnly?: boolean },
  ) => {
    event.shiftKey ? addToselectItems(id) : selectItem(id, { contentOnly });
  };

  type SelectItemOptions = { contentOnly: boolean };

  const selectItem = (
    id: UniqueIdentifier,
    { contentOnly }: SelectItemOptions = { contentOnly: true },
  ) => {
    const { utilities } = writer;

    const itemSelected = visibleTree.find((visibled) => visibled.id === id);
    if (!itemSelected) return;

    setSelectedItems([id]);
    setMultiselectAnchor(id);

    const { parentId, nodeIndex, xpath } = itemSelected;

    if (itemSelected.type === 'text') contentOnly = false;

    // focusEditor: false — keep keyboard focus on the tree panel so arrow-key navigation can
    // continue uninterrupted; the editor's selection/scroll still updates to follow along.
    utilities.selectNode(
      { id: id as string, nodeIndex, parentId: parentId as string, xpath },
      contentOnly,
      false,
    );

    // Keep keyboard focus on the (non-virtualized) container rather than the clicked/selected
    // row's own button, since that row can unmount when scrolled out of the virtualized list.
    treeContainerRef.current?.focus({ preventScroll: true });
    return;
  };

  const moveSelection = (direction: 1 | -1) => {
    const currentId = selectedItems[0];
    const currentIndex = visibleTree.findIndex(({ id }) => id === currentId);

    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : visibleTree.length - 1
        : Math.min(Math.max(currentIndex + direction, 0), visibleTree.length - 1);

    const nextItem = visibleTree[nextIndex];
    if (nextItem) selectItem(nextItem.id);
  };

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentId = selectedItems[0];
    const currentItem = visibleTree.find(({ id }) => id === currentId);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveSelection(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveSelection(-1);
        break;
      case 'ArrowRight':
        if (currentItem?.children.length && !expandedItems.includes(currentId)) {
          event.preventDefault();
          handleExpand(currentId, true);
        }
        break;
      case 'ArrowLeft':
        if (currentItem?.children.length && expandedItems.includes(currentId)) {
          event.preventDefault();
          handleExpand(currentId, false);
        }
        break;
      case 'Backspace':
      case 'Delete': {
        if (!currentItem) break;
        if ([writer.schemaManager.getRoot(), writer.schemaManager.getHeader()].includes(currentItem.label)) {
          break;
        }
        event.preventDefault();
        const parentId = currentItem.parentId;
        if (event.shiftKey) {
          // delete tag and contents
          writer.tagger.removeStructureTag(currentId as string, true);
        } else {
          // unwrap — remove tag, keep contents
          writer.tagger.removeTag(currentId as string);
        }
        // let the tree data re-sync to the mutated DOM before moving selection up to the parent
        if (parentId) window.setTimeout(() => selectItem(parentId), 0);
        break;
      }
      case 'F2':
      case 'Enter': {
        if (!currentItem || currentItem.type === 'text') break;
        if ([writer.schemaManager.getRoot(), writer.schemaManager.getHeader()].includes(currentItem.label)) {
          break;
        }

        // Anchor the popup near the selected tree row instead of an (absent) editor caret.
        // The editor's own selection already reflects this node (selectItem/utilities.selectNode
        // set it), which is what the popup's tag/attribute resolution actually reads from.
        const rowEl = treeContainerRef.current?.querySelector('.Mui-selected');
        const rect = rowEl?.getBoundingClientRect();
        if (!rect) break;
        const anchor = { left: rect.left, top: rect.bottom };

        event.preventDefault();
        if (event.key === 'F2') {
          void window.__desktopTagging?.openTagPopup?.('rename', anchor);
        } else if (event.altKey) {
          void window.__desktopTagging?.openAttributePopup?.(anchor);
        } else {
          void window.__desktopTagging?.openTagPopup?.('wrap', anchor);
        }
        break;
      }
    }
  };

  //* expand selection from first to last
  const addToselectItems = (id: UniqueIdentifier) => {
    const { utilities } = writer;

    if (!canAddToMultiselection(id)) return;

    const target = visibleTree.find((item) => item.id === id);
    const anchor = visibleTree.find((item) => item.id === multiselectAnchor);
    if (!anchor || !target) return;

    const expandedSelection: string[] = [];

    let firstIndex = Math.min(anchor.index, target.index);
    let lastIndex = Math.max(anchor.index, target.index);

    for (let i = firstIndex; i <= lastIndex; i++) {
      const item = visibleTree.find(
        ({ depth, index, parentId }) =>
          depth === anchor.depth && parentId === anchor.parentId && index === i,
      );
      if (item) expandedSelection.push(item.id as string);
    }

    setSelectedItems(expandedSelection);

    const startItem = visibleTree.find((visibled) => visibled.id === expandedSelection.at(0));
    const endItem = visibleTree.find((visibled) => visibled.id === expandedSelection.at(-1));
    if (!startItem || !endItem) return;

    utilities.selectAdjacentNodes(
      [
        {
          id: startItem.id as string,
          nodeIndex: startItem.nodeIndex,
          parentId: startItem.parentId as string,
          xpath: startItem.xpath,
        },
        {
          id: endItem.id as string,
          nodeIndex: endItem.nodeIndex,
          parentId: endItem.parentId as string,
          xpath: endItem.xpath,
        },
      ],
      false,
    );

    treeContainerRef.current?.focus({ preventScroll: true });
  };

  const handleContextMenu = (
    event: MouseEvent<HTMLElement, Event>,
    { id }: { id: string; contentOnly?: boolean },
  ) => {
    const position = { posX: event.clientX, posY: event.clientY };
    selectedItems.includes(id) && selectedItems.length > 1
      ? openContextMenuForMultipleItem(position)
      : openContextMenuForSingleItem(id, position);
  };

  const openContextMenuForSingleItem = (
    id: UniqueIdentifier,
    position: { posX: number; posY: number },
  ) => {
    if (!selectedItems.includes(id)) selectItem(id);
    const selectedItem = visibleTree.find((item) => item.id === id);

    showContextMenu({
      eventSource: 'markupPanel',
      nodeType: selectedItem?.type,
      position,
      tagId: id as string,
      xpath: selectedItem?.xpath,
    });
  };

  const openContextMenuForMultipleItem = (position: { posX: number; posY: number }) => {
    const tagIds = [...(selectedItems as string[])].sort((a, b) => {
      const tagA = visibleTree.find((item) => item.id === a);
      const tagB = visibleTree.find((item) => item.id === b);
      if (!tagA || !tagB) return 0;
      if (tagA.index < tagB.index) return -1;
      if (tagA.index > tagB.index) return 1;
      return 0;
    });

    const allowsMerge = () => {
      if (!Array.isArray(tagIds)) return false;
      const anchor = visibleTree.find(({ id }) => id === multiselectAnchor);
      return tagIds.every(
        (tagId) => visibleTree.find(({ id }) => id === tagId)?.label === anchor?.label,
      );
    };

    showContextMenu({
      allowsMerge: allowsMerge(),
      count: Array.isArray(tagIds) ? tagIds.length : undefined,
      eventSource: 'markupPanel',
      position,
      tagId: tagIds,
      useSelection: false,
    });
  };

  const shouldBeDraggable = (label: string) => {
    if (label === writer.schemaManager.getRoot()) return false;
    if (label === writer.schemaManager.getHeader()) return false;
    return true;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const { id: activeId } = active;

    setActiveId(activeId);
    setOverId(activeId);
    setSelectedItems([]);

    document.body.style.setProperty('cursor', 'grabbing');
  };

  const handleDragMove = ({ delta, over }: DragMoveEvent) => {
    if (over) {
      const overIndex = visibleTree.findIndex(({ id }) => id === over.id);
      const overItem = visibleTree[overIndex];
      if (overItem?.type === 'text') return;
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
      if (!parentId) return;

      const parentIndex = visibleTree.findIndex(({ id }) => id === parentId);
      if (visibleTree[parentIndex]?.type === 'text') return;

      // const overIndex = flattenedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = visibleTree.findIndex(({ id }) => id === active.id);
      const overIndexParent = visibleTree[parentIndex]?.children.findIndex(
        ({ id }) => id === over.id,
      );
      // const activeTreeItem = flattenedItems[activeIndex];Í

      const position = delta.y >= 0 ? 'after' : 'before';

      if (!overIndexParent || overIndexParent < 0) return;

      moveNode({ childIndex: overIndexParent, dragId: active.id, dropId: parentId, position });
    }
  };

  const handleDragCancel = () => {
    resetState();
  };

  const resetState = () => {
    setOverId(null);
    setActiveId(0);
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
        <div
          ref={treeContainerRef}
          tabIndex={0}
          onKeyDown={handleTreeKeyDown}
          style={{ height: '100%', outline: 'none' }}
        >
        <Virtuoso
          ref={virtuoso}
          overscan={1000}
          data={visibleTree}
          itemContent={(index, { id, content, children, isEntity, depth, label, type }) => {
            return (
              <SortableTreeItem
                key={id}
                canAddToMultiselection={canAddToMultiselection}
                content={content}
                depth={id === activeId && projected ? projected.depth : depth}
                // disableInteraction={type === 'node'}
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
                onSelectItem={handleSelectItem}
                selected={selectedItems.includes(id)}
                type={type}
              />
            );
          }}
          style={{ height: '100%' }}
        />
        </div>
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
          document.body,
        )}
      </SortableContext>
    </DndContext>
  );
};
