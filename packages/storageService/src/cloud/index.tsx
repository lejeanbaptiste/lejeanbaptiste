import { Stack, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { Main } from './main';
import { Sidebar } from './sidebar';

export const CloudDialog = () => {
  const { breakpoints } = useTheme();
  const isSM = useMediaQuery(breakpoints.down('sm'));

  return (
    <Stack direction={isSM ? 'column' : 'row'} height="100%">
      <Sidebar />
      <Main />
    </Stack>
  );
};
