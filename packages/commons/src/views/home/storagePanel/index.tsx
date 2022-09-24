import { Container, Paper, Stack, useMediaQuery, useTheme } from '@mui/material';
import TeaIcon from '@src/assets/icons/tea';
import { useAppState } from '@src/overmind';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import React, { type FC } from 'react';
import OpenOptions from './OpenOptions';
import Recent from './Recent';
import { Templates } from './Templates';

const StoragePanel: FC = () => {
  const { userState } = useAppState().auth;

  const { breakpoints, palette } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('sm'));

  const conainerVariants: Variants = {
    initial: { height: 0 },
    visible: { height: '50vh' },
    exit: { height: 0 },
  };

  return (
    <AnimatePresence>
      {userState === 'UNAUTHENTICATED' ? (
        <></>
      ) : userState === 'AUTHENTICATING' ? (
        <Stack width="100%" height={141} alignItems="center" justifyContent="center" spacing={1}>
          <TeaIcon color={palette.secondary.dark} size={2} />
        </Stack>
      ) : (
        <Paper
          component={motion.div}
          variants={conainerVariants}
          initial="initial"
          animate="visible"
          exit="exit"
          transition={{ type: 'tween' }}
          elevation={palette.mode === 'dark' ? 0 : 0}
          sx={{ py: isMobile ? 1 : 2, overflow: 'hidden' }}
        >
          <Container>
            <Stack
              direction={isMobile ? 'column-reverse' : 'column'}
              alignItems="center"
              spacing={isMobile ? 5 : 3}
            >
              <Templates />
              <Stack
                direction={isMobile ? 'column-reverse' : 'row'}
                spacing={5}
                width={isMobile ? '90vw' : 700}
                pl={2}
              >
                <OpenOptions />
                <Recent />
              </Stack>
            </Stack>
          </Container>
        </Paper>
      )}
    </AnimatePresence>
  );
};

export default StoragePanel;
