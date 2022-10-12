import { Button } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import type { ISample } from '@src/types';
import React, { type FC } from 'react';

interface SampleFileCardProps {
  onClick: (sample: ISample) => void;
  resource: ISample;
}

export const SampleFileCard: FC<SampleFileCardProps> = ({ onClick, resource }) => {
  const { icon, title } = resource;
  const Icon = getIcon(icon ?? 'insertDriveFile');

  const handleClick = async () => onClick(resource);

  return (
    <Button
      onClick={handleClick}
      startIcon={<Icon />}
      sx={{ mx: 2, px: 2, textTransform: 'inherit' }}
    >
      {title}
    </Button>
  );
};
