import { Icon, useTheme } from '@mui/material';
import { useMemo } from 'react';
import { type IconLeafWriter } from '../../../../../icons';
import { isEntityType } from '../../../../../types';
import { useContextmenu } from '../../../hooks';
export interface IconLeftProps {
  entityType?: string;
  icon: IconLeafWriter;
}

export const IconLeft = ({ entityType, icon }: IconLeftProps) => {
  const { entity } = useTheme();
  const { getIcon } = useContextmenu();

  // Keyed to the icon name; `getIcon` is a context helper rebuilt every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const IconComponent = useMemo(() => getIcon(icon), [icon]);
  const color =
    entityType && isEntityType(entityType, entity) ? entity[entityType].color.main : 'inherit';

  return <Icon component={IconComponent} sx={{ height: 16, width: 16, color }} />;
};
