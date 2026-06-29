import { Box, GlobalStyles } from '@mui/material';
import { TitleBar, TITLEBAR_HEIGHT } from '@src/desktop/TitleBar';
import { useDialog, useNotifier } from '@src/hooks';
import { isDesktop } from '@src/types/desktop';
import { Outlet } from 'react-router';

export const BasicLayout = () => {
  useDialog();
  useNotifier();

  const desktop = isDesktop();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', bgcolor: 'background.default' }}>
      {desktop && (
        <GlobalStyles styles={{ ':root': { '--titlebar-height': `${TITLEBAR_HEIGHT}px` } }} />
      )}
      {desktop && <TitleBar />}
      <Box sx={{ flex: '1 1 auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
};
