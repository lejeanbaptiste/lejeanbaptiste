import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses, type TooltipProps } from '@mui/material/Tooltip';
import React from 'react';

export const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    textTransform: 'capitalize !important',
  },
  [`& .${tooltipClasses.tooltipPlacementBottom}`]: {
    marginTop: '10px !important',
  },
}));
