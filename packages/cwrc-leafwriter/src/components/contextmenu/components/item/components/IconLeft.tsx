import { Icon, useTheme } from '@mui/material';
import { useMemo } from 'react';
import { ItemProps } from '../';
import { isEntityType } from '../../../../../types';
import { useContextmenu } from '../../../hooks';
export interface IconLeftProps {
  entityType?: string;
  icon: Exclude<ItemProps['icon'], undefined>;
}

export const IconLeft = ({ entityType, icon }: IconLeftProps) => {
  const { entity } = useTheme();
  const { getIcon } = useContextmenu();

  const IconComponent = useMemo(() => getIcon(icon), [icon]);
  const color = entityType && isEntityType(entityType) ? entity[entityType].color.main : 'inherit';

  return <Icon component={IconComponent} sx={{ height: 18, width: 18, color }} />;
};
