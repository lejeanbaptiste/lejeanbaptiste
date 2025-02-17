import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses, type TooltipProps } from '@mui/material/Tooltip';

export const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip
    {...props}
    classes={{ popper: className }}
    slotProps={{
      tooltip: {
        sx: { '::first-letter': { textTransform: 'uppercase' } },
      },
    }}
  />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltipPlacementBottom}`]: {
    marginTop: '10px !important',
  },
}));
