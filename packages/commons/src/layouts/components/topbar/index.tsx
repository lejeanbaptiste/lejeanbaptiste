import { AppBar, Box, Stack, Toolbar, useTheme } from '@mui/material';
import { useAppState } from '@src/overmind';
import { AnimatePresence } from 'framer-motion';
import React, { FC } from 'react';
import DarkMode from './DarkMode';
import LanguageMenu from './LanguageMenu';
import { ProfileAvatar } from './ProfileAvatar';

interface TopBarProps {
  Left?: React.ReactNode;
  Meta?: React.ReactNode;
  title?: string;
}

export const TopBar: FC<TopBarProps> = ({ Left, Meta, title = 'LEAF-Writer' }) => {
  const { userState } = useAppState().auth;
  const { resource } = useAppState().storage;

  const { palette } = useTheme();

  return (
    <AppBar
      color="inherit"
      elevation={!resource ? 0 : palette.mode === 'dark' ? 2 : 1}
      position="relative"
    >
      <Toolbar variant="dense">
        <Stack direction="row" alignItems="center">
          {Left}
        </Stack>

        <Box flexGrow={1} />

        {Meta}

        <Box flexGrow={1} />

        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          width={187}
          // alignItems="flex-end"
          justifyContent="flex-end"
        >
          <AnimatePresence mode="wait">
            {userState === 'AUTHENTICATED' ? (
              <ProfileAvatar />
            ) : (
              <>
                <DarkMode />
                <LanguageMenu />
              </>
            )}
          </AnimatePresence>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
