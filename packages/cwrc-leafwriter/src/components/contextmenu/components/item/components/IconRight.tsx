import { CircularProgress, Icon } from '@mui/material';
import { useMemo } from 'react';
import { type IconLeafWriter } from '../../../../../icons';
import { useContextmenu } from '../../../hooks';

export interface IconRightProps {
  icon: IconLeafWriter;
  isLoading?: boolean;
  size?: number;
}

export const IconRight = ({ icon, isLoading, size = 16 }: IconRightProps) => {
  const { getIcon } = useContextmenu();
  // Keyed to the icon name; `getIcon` is a context helper rebuilt every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
