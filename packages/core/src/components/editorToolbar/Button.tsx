import { Button as MuiButton, Icon } from '@mui/material';
import React from 'react';
import { StyledToolTip } from '../../components';
import { getIcon } from '../../icons';

import { type MenuItem } from './';

export const Button = ({ icon, onClick, title, tooltip }: MenuItem) => {
  return (
    <StyledToolTip enterDelay={2000} title={tooltip ?? title}>
      <MuiButton
        color="primary"
        onClick={onClick}
        startIcon={<Icon component={getIcon(icon)} fontSize="small" />}
        sx={{ height: 34, textTransform: 'capitalize' }}
      >
        {title}
      </MuiButton>
    </StyledToolTip>
  );
};
