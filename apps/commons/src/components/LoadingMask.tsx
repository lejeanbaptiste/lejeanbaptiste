import { Backdrop, useTheme } from '@mui/material';
import { TeaIcon } from '@src/icons';

export const LoadingMask = () => {
  const theme = useTheme();
  return (
    <Backdrop sx={[(theme) => ({ zIndex: theme.vars.zIndex.drawer + 1 })]} open={true} invisible>
      <TeaIcon color={theme.vars.palette.secondary.dark} size={2} />
    </Backdrop>
  );
};
