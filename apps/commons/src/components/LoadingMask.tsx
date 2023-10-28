import { Backdrop, useTheme } from '@mui/material';
import { TeaIcon } from '@src/icons';

export const LoadingMask = () => {
  const { palette, zIndex } = useTheme();
  return (
    <Backdrop sx={{ zIndex: zIndex.drawer + 1 }} open={true} invisible>
      <TeaIcon color={palette.secondary.dark} size={2} />
    </Backdrop>
  );
};
