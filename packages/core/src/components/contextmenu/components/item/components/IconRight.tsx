import { CircularProgress, Icon } from '@mui/material';
import { useMemo } from 'react';
import { ItemProps } from '../';
import { useContextmenu } from '../../../hooks';

export interface IconRightProps {
  icon: Exclude<ItemProps['icon'], undefined>;
  isLoading?: boolean;
  size?: number;
}

export const IconRight = ({ icon, isLoading, size = 16 }: IconRightProps) => {
  const { getIcon } = useContextmenu();
  const IconComponent = useMemo(() => (icon ? getIcon(icon) : null), [icon]);

  return (
    <>
      {isLoading ? (
        <CircularProgress size={16} thickness={5} />
      ) : (
        IconComponent && <Icon component={IconComponent} sx={{ fontSize: size }} />
      )}
    </>
  );
};
