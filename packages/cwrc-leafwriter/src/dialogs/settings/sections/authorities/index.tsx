import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core/dist/types';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Stack, Typography } from '@mui/material';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdFilterTiltShift } from 'react-icons/md';
import { authorityServicesAtom, reorderLookupPriorityAtom } from '../../../../jotai/entity-lookup';
import type { AuthorityService } from '../../../../types';
import { Authority } from './Authority';

export const Authorities = () => {
  const { t } = useTranslation();
  const authorityServices = useAtomValue(authorityServicesAtom);
  const reorderLookupPriority = useSetAtom(reorderLookupPriorityAtom);

  const sensors = useSensors(useSensor(PointerSensor));

  const [items, setItems] = useState<AuthorityService[]>(
    Array.from(authorityServices.values()).toSorted(
      (a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity),
    ),
  );

  useEffect(() => {
    console.log(authorityServices);
    const authtoriesList = Array.from(authorityServices.values()).toSorted(
      (a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity),
    );
    setItems(authtoriesList);
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
      <Stack direction="row" mx={1} gap={1.5}>
        <MdFilterTiltShift style={{ height: 18, width: 18, marginLeft: 8, marginTop: 2 }} />
        <Stack>
          <Typography variant="body2">{t('LW.Entities Lookup Sources')}</Typography>
          <Typography color="text.secondary" variant="caption">
            {t('LW.Drag authorities to reorder priority')}
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
            {items.map((item) => (
              <Authority key={item.id} authorityService={item} />
            ))}
          </SortableContext>
        </DndContext>
      </Stack>
    </Stack>
  );
};
