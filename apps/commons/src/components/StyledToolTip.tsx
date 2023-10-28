import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses, type TooltipProps } from '@mui/material/Tooltip';

export const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    '::first-letter': { textTransform: 'uppercase !important' },
  },
  [`& .${tooltipClasses.tooltipPlacementBottom}`]: {
    marginTop: '10px !important',
  },
}));
