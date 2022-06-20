import { Backdrop, useTheme } from '@mui/material';
import React, { FC } from 'react';
import TeaIcon from '@src/assets/icons/tea';

const LoadingMask: FC = () => {
  const { palette, zIndex } = useTheme();
  return (
    <Backdrop sx={{ zIndex: zIndex.drawer + 1 }} open={true} invisible>
      <TeaIcon color={palette.secondary.dark} size={2} />
    </Backdrop>
  );
};

export default LoadingMask;
