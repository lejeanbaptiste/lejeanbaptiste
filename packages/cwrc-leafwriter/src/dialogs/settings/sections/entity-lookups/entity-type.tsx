import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Stack, Typography } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../../../db';
import { Icon } from '../../../../icons';
import type { LookupServicePreference, NamedEntityType } from '../../../../types';
import { capitalizeString } from '../../../../utilities';
import { Authority } from './authority';
import { useLookupServicePrefeneces } from './useLookupEntity';

export const EntityType = ({ entityType }: { entityType: NamedEntityType }) => {
  const { t } = useTranslation();

  const entityTypes = useLiveQuery(
    () => db.lookupServicePreferences.where({ entityType }).sortBy('priority'),
    [],
    [],
  );

  const sensors = useSensors(useSensor(PointerSensor));

  const { reorderLookupPriority } = useLookupServicePrefeneces();

  const [items, setItems] = useState<LookupServicePreference[]>(entityTypes);

  useEffect(() => {
    setItems(entityTypes);
  }, [entityTypes.map((item) => item.disabled).join('-')]);

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
    <Stack
      height="100%"
      p={1}
      gap={1}
      border={(theme) => `1px solid ${theme.vars.palette.divider}`}
      borderRadius={1}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        mx={1}
        pb={0.5}
        borderBottom={1}
        borderColor="divider"
      >
        <Icon color="primary" fontSize="small" name={entityType} />
        <Typography color="primary" fontWeight={700} variant="body1">
          {capitalizeString(t(`LW.entity.${entityType}`))}
        </Typography>
      </Stack>
      <Stack gap={0.25}>
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          sensors={sensors}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {items?.map((item) => <Authority key={item.id} servicePreference={item} />)}
          </SortableContext>
        </DndContext>
      </Stack>
    </Stack>
  );
};
