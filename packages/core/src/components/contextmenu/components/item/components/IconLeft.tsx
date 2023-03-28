import { Icon, useTheme } from '@mui/material';
import React, { useMemo } from 'react';
import { ItemProps } from '../';
import { useContextmenu } from '../../../hooks';

export interface IconLeftProps {
  entityType?: string;
  icon: Exclude<ItemProps['icon'], undefined>;
}

export const IconLeft = ({ entityType, icon }: IconLeftProps) => {
  const { entity } = useTheme();
  const { getIcon, isEntityType } = useContextmenu();

  const IconComponent = useMemo(() => getIcon(icon), [icon]);
  const color = entityType && isEntityType(entityType) ? entity[entityType].color.main : 'inherit';

  return <Icon component={IconComponent} sx={{ height: 18, width: 18, color }} />;
};
