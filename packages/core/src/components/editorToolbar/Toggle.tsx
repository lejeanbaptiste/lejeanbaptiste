import { Icon, ToggleButton } from '@mui/material';
import React from 'react';
import { StyledToolTip } from '../../components';
import { getIcon } from '../../icons';

import { type MenuItem } from './';

export const Toggle = ({ icon, onClick, selected, title }: MenuItem) => {
  return (
    <StyledToolTip enterDelay={2000} title={title}>
      <ToggleButton
        aria-label={title}
        onClick={onClick}
        selected={selected}
        size="small"
        sx={{
          width: 34,
          height: 34,
          borderRadius: 1,
          border: 'none',
          color: ({ palette }) => palette.primary.main,
        }}
        value="check"
      >
        <Icon component={getIcon(icon)} fontSize="small" />
      </ToggleButton>
    </StyledToolTip>
  );
};
