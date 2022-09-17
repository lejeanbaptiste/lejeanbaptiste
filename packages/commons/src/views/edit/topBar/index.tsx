import { AppBar, Box, Stack, Toolbar, useTheme } from '@mui/material';
import Logo from '@src/components/Logo';
import ProfileAvatar from '@src/components/ProfileAvatar';
import { useAppState } from '@src/overmind';
import { AnimatePresence } from 'framer-motion';
import React, { FC } from 'react';
import MainMenu from './MainMenu';
import { Meta } from './Meta';

interface TopBarProps {
  title?: string;
}

const TopBar: FC<TopBarProps> = ({ title = 'LEAF-Writer' }) => {
  const { userState } = useAppState().auth;
  const { isDirty } = useAppState().editor;
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
          <MainMenu />
          <Logo height={24} size="small" />
        </Stack>

        {resource && (
          <>
            <Box flexGrow={1} />
            <Meta resource={resource} isDirty={isDirty} />
          </>
        )}

        <Box flexGrow={1} />

        <Stack width={186} alignItems="flex-end">
          <AnimatePresence mode="wait">
            {userState === 'AUTHENTICATED' && <ProfileAvatar />}
          </AnimatePresence>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
