import { useTheme, type PaletteMode } from '@mui/material';
import { useMemo } from 'react';
import { getIcon, type IconLeafWriter } from '../../../../../icons';
import { EntityType } from '../../../../../types';

export const useItem = (id: string, isEntity: boolean = false) => {
  const { entity, palette } = useTheme();

  const { entitiesManager } = window.writer;

  const entityType = isEntity ? entitiesManager.getEntity(id).getType() : null;

  const color = useMemo(() => {
    if (!entityType) return 'inherent';
    if (Object.values(EntityType).includes(entityType as EntityType)) {
      return entity[entityType as EntityType].color.main;
    }
    return 'inherent';
  }, [entityType]);

  const icon = useMemo(() => {
    if (Object.values(EntityType).includes(entityType as EntityType)) {
      return getIcon(entity[entityType].icon as IconLeafWriter);
    }
    return getIcon(entityType as IconLeafWriter);
  }, [entityType]);

  const inverseThemeMode: PaletteMode = useMemo(
    () => (palette.mode === 'light' ? 'dark' : 'light'),
    [palette.mode]
  );

  return {
    color,
    icon,
    inverseThemeMode,
  };
};
