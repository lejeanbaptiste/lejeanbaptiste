import { Button } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import type { ISample } from '@src/types';
import React, { type FC } from 'react';

interface TemplateCard {
  onClick: (resource: ISample) => void;
  onDoubleClick?: (resource: ISample) => void;
  selected?: ISample;
  size?: 'small' | 'medium' | 'large';
  template: ISample;
}

export const TemplateCard: FC<TemplateCard> = ({
  onClick,
  onDoubleClick,
  selected,
  size = 'medium',
  template,
}) => {
  const { icon, title } = template;
  const Icon = getIcon(icon ?? 'blankPage');

  const handleClick = () => onClick(template);

  const handleDoubleClick = () => {
    onDoubleClick && onDoubleClick(template);
  };

  return (
    <Button
      disableElevation
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      size={size}
      startIcon={<Icon />}
      sx={{ textTransform: 'inherit' }}
      variant={selected?.url === template.url ? 'contained' : 'text'}
    >
      {title}
    </Button>
  );
};
