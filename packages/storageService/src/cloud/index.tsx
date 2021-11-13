import { Stack, useMediaQuery, useTheme } from '@mui/material';
import React, { FC } from 'react';
import Sidebar from './sidebar';
import Main from './main';

const CloudDialog: FC = () => {
  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Stack direction={isSM ? 'column' : 'row'}>
      <Sidebar />
      <Main />
    </Stack>
  );
};

export default CloudDialog;
