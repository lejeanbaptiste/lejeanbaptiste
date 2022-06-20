import { Stack, useMediaQuery, useTheme } from '@mui/material';
import React, { FC } from 'react';
import Main from './main';
import Sidebar from './sidebar';

const CloudDialog: FC = () => {
  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Stack direction={isSM ? 'column' : 'row'} height="100%">
      <Sidebar />
      <Main />
    </Stack>
  );
};

export default CloudDialog;
