import { Box, Container, Stack } from '@mui/material';
import { useAppState } from '@src/overmind';
import { AnimatePresence } from 'framer-motion';
import React, { FC } from 'react';
import DarkMode from './DarkMode';
import LanguageMenu from './LanguageMenu';
import ProfileAvatar from '../ProfileAvatar';

const TopBar: FC = () => {
  const { userState } = useAppState().auth;

  return (
    <Box position="absolute" width={'100%'}>
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="flex-end" py={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <AnimatePresence exitBeforeEnter>
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
        </Box>
      </Container>
    </Box>
  );
};

export default TopBar;
