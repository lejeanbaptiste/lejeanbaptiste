import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses, type TooltipProps } from '@mui/material/Tooltip';
import React from 'react';

export const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip
    {...props}
    classes={{ popper: className }}
    componentsProps={{ tooltip: { sx: { '::first-letter': { textTransform: 'uppercase' } } } }}
  />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltipPlacementBottom}`]: {
    marginTop: '10px !important',
  },
}));
