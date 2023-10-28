import { AppBar, Box, Stack, Toolbar, useTheme } from '@mui/material';
import { EditorModeSelector, ProfileAvatar, SigninButton } from '@src/components';
import { useAppState } from '@src/overmind';
import { AnimatePresence } from 'framer-motion';
import { DarkMode } from './DarkMode';
import { LanguageMenu } from './LanguageMenu';
import { Privacy } from './Privacy';
import { ProfileAnchor } from './ProfileAnchor';
import { Settings } from './Settings';

interface TopBarProps {
  Center?: React.ReactNode;
  Left?: React.ReactNode;
}

export const TopBar = ({ Center, Left }: TopBarProps) => {
  const { userState } = useAppState().auth;
  const { resource } = useAppState().editor;
  const { page } = useAppState().ui;

  const { palette } = useTheme();

  return (
    <AppBar
      color="inherit"
      elevation={!resource ? 0 : palette.mode === 'dark' ? 2 : 1}
      position="relative"
    >
      <Toolbar
        sx={{ flexWrap: 'wrap', justifyContent: 'space-between', maxHeight: '48px' }}
        variant="dense"
      >
        <Stack direction="row" alignItems="center">
          {Left}
        </Stack>
        {Center}
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          width={187}
          justifyContent="flex-end"
        >
          <AnimatePresence mode="wait">
            {userState === 'AUTHENTICATED' ? (
              <>
                {page !== 'home' && <EditorModeSelector />}
                <ProfileAnchor>
                  <ProfileAvatar />
                </ProfileAnchor>
              </>
            ) : userState === 'UNAUTHENTICATED' ? (
              <>
                <Privacy />
                <Settings />
                <DarkMode />
                <LanguageMenu />
                {page !== 'home' && <SigninButton />}
              </>
            ) : null}
          </AnimatePresence>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
