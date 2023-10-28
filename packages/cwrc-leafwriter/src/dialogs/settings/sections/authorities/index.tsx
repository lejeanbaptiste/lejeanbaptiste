import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { DragEndEvent } from '@dnd-kit/core/dist/types';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import FilterTiltShiftIcon from '@mui/icons-material/FilterTiltShift';
import { Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import { AuthorityService } from '../../../entityLookups';
import { Authority } from './Authority';

export const Authorities = () => {
  const { t } = useTranslation('leafwriter');
  const { authorityServices } = useAppState().editor;
  const { reorderLookupPriority } = useActions().editor;

  const sensors = useSensors(useSensor(PointerSensor));

  const [items, setItems] = useState<AuthorityService[]>([]);

  useEffect(() => {
    const authtoriesList = [...Object.values(authorityServices)].sort(
      (a, b) => a.priority - b.priority,
    );
    setItems(authtoriesList);
    return () => {};
  }, [authorityServices]);

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
    <Stack width="100%" py={1} spacing={2}>
      <Stack direction="row">
        <FilterTiltShiftIcon sx={{ mx: 1, height: 18, width: 18, mt: 0.25 }} />
        <Stack>
          <Typography variant="body2">{t('Entities Lookup Sources')}</Typography>
          <Typography color="text.secondary" variant="caption">
            {t('Drag authorities to reorder priority')}
          </Typography>
        </Stack>
      </Stack>

      <Stack mt={1} spacing={1}>
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          sensors={sensors}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {items.map((authority) => (
              <Authority key={authority.id} authorityService={authority} />
            ))}
          </SortableContext>
        </DndContext>
      </Stack>
    </Stack>
  );
};
