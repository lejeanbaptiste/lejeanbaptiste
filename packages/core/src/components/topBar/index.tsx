import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { AppBar, Box, IconButton, Toolbar, Typography, useTheme } from '@mui/material';
import Badge, { BadgeProps } from '@mui/material/Badge';
import { styled } from '@mui/material/styles';
import { AnimatePresence } from 'framer-motion';
import React, { FC } from 'react';
import { useActions, useAppState } from '../../overmind';
import MainMenu from './MainMenu';
import ProfileAvatar from './ProfileAvatar';

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  '& .MuiBadge-badge': { top: -3, left: 9, minWidth: 4, height: 4 },
}));

interface TopBarProps {
  helpUrl?: string;
  title?: string;
}

const TopBar: FC<TopBarProps> = ({ title = 'leaf writer' }) => {
  const { resource } = useAppState().document;
  const { isEditorDirty } = useAppState().editor;
  const { saveDocument } = useActions().editor;
  const { palette } = useTheme();

  const handleSave = () => saveDocument();

  return (
    <div>
      <AppBar color="inherit" elevation={palette.mode === 'dark' ? 2 : 1}>
        <Toolbar variant="dense">
          <MainMenu />

          <Box display="flex" flexDirection="row" alignItems="center" justifyContent="center">
            <img
              src={`/images/cwrclogo-${palette.mode === 'light' ? 'black' : 'white'}.png`}
              alt="leaf writer"
              height={24}
            />
          </Box>

          <Typography component="h1" sx={{ marginLeft: 1, cursor: 'default' }} variant="subtitle1">
            {title}
          </Typography>

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
              <IconButton aria-label="save" onClick={handleSave} size="small" sx={{ ml: 0.5 }}>
                {isEditorDirty && <StyledBadge color="primary" variant="dot"></StyledBadge>}
                <CloudQueueIcon fontSize="inherit" sx={{ width: 12, height: 12 }} />
              </IconButton>
            </>
          )}

          <Box flexGrow={1} />

          <AnimatePresence exitBeforeEnter>
            <ProfileAvatar />
          </AnimatePresence>
        </Toolbar>
      </AppBar>
    </div>
  );
};

export default TopBar;
