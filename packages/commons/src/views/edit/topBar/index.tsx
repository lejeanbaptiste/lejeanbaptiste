import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import {
  AppBar,
  Box,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Badge, { BadgeProps } from '@mui/material/Badge';
import { styled } from '@mui/material/styles';
import ProfileAvatar from '@src/components/ProfileAvatar';
import { useActions, useAppState } from '@src/overmind';
import { AnimatePresence } from 'framer-motion';
import React, { FC } from 'react';
import MainMenu from './MainMenu';
import Logo from '@src/components/Logo';

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  '& .MuiBadge-badge': { top: -3, left: 9, minWidth: 4, height: 4 },
}));

interface TopBarProps {
  helpUrl?: string;
  title?: string;
}

const TopBar: FC<TopBarProps> = ({ title = 'LEAF-Writer' }) => {
  const { userState } = useAppState().auth;
  const { isDirty } = useAppState().editor;
  const { resource } = useAppState().storage;

  const { editor, storage } = useActions();

  const { palette } = useTheme();

  const handleSave = async () => {
    const saved = await editor.save();
    if (saved?.success === true) storage.updateRecentDocument();
  };

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
            <Typography
              component="h3"
              sx={{ marginLeft: 1, cursor: 'default' }}
              variant="subtitle1"
            >
              {resource.filename ?? 'untitled.xml'}
            </Typography>
            <Tooltip title={isDirty ? 'Click to sync' : 'Synced to the cloud'}>
              <IconButton aria-label="save" onClick={handleSave} size="small" sx={{ ml: 0.5 }}>
                {isDirty && <StyledBadge color="primary" variant="dot"></StyledBadge>}
                <CloudQueueIcon fontSize="inherit" sx={{ width: 12, height: 12 }} />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Box flexGrow={1} />

        <Stack width={186} alignItems="flex-end">
          <AnimatePresence exitBeforeEnter>
            {userState === 'AUTHENTICATED' && <ProfileAvatar />}
          </AnimatePresence>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
