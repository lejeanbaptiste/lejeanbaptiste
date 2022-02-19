import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { DragEndEvent } from '@dnd-kit/core/dist/types';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import FilterTiltShiftIcon from '@mui/icons-material/FilterTiltShift';
import { Stack, Typography } from '@mui/material';
import { ILookupService } from '@src/components/entityLookups/types';
import { useActions, useAppState } from '@src/overmind';
import React, { FC, useEffect, useState } from 'react';
import AuthoritySource from './AuthoritySource';

const AutoritiesPanel: FC = () => {
  const { authorities } = useAppState().editor.lookups;
  const { reorderLookupPriority } = useActions().editor;
  const sensors = useSensors(useSensor(PointerSensor));
  const [items, setItems] = useState<ILookupService[]>([]);

  useEffect(() => {
    if (!authorities) return;

    const authtoriesList = Object.values(authorities).sort((a, b) => a.priority - b.priority);
    setItems(authtoriesList);

    return () => {};
  }, [authorities]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!items || !over) return;

    if (active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);

      setItems(newOrder);
      reorderLookupPriority(newOrder);
    }
  };

  return (
    <Stack width="'100%'" mb={2}>
      <Stack direction="row" sx={{ p: 2 }}>
        <FilterTiltShiftIcon fontSize="small" sx={{ mt: 0.25, mr: 2 }} />
        <Typography>Entities Lookup Sources</Typography>
      </Stack>
      {items && (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          sensors={sensors}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {items.map((authority) => (
              <AuthoritySource key={authority.id} authority={authority} />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </Stack>
  );
};

export default AutoritiesPanel;
