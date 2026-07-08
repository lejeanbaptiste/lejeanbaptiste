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

  const IconComponent = useMemo(() => getIcon(icon), [icon]);
  const color = entityType && isEntityType(entityType) ? entity[entityType].color.main : 'inherit';

  return <Icon component={IconComponent} sx={{ height: 16, width: 16, color }} />;
};
