import { Container, Divider, Paper, Skeleton, Stack, useMediaQuery, useTheme } from '@mui/material';
import { useAppState } from '@src/overmind';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC } from 'react';
import OpenOptions from './OpenOptions';
import Recent from './Recent';
import Templates from './Templates';
import SampleSection from './SampleSection';

const StoragePanel: FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { recentDocuments, userAuthenticated } = useAppState();

  const conainerVariants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0 },
  };

  return (
    <AnimatePresence>
      {!userAuthenticated ? (
        ''
      ) : userAuthenticated === 'authenticating' ? (
        <Skeleton variant="rectangular" width="100%" height={100} />
      ) : (
        <Paper
          component={motion.div}
          variants={conainerVariants}
          initial="initial"
          animate="visible"
          exit="exit"
          elevation={theme.palette.mode === 'dark' ? 2 : 0}
          sx={{
            py: 5,
            background: theme.palette.mode === 'dark' ? 'inherent' : '#f9f9f9',
            overflow: 'hidden',
          }}
        >
          <Container maxWidth="lg">
            <Stack
              direction={isMobile ? 'column-reverse' : 'row'}
              justifyContent="center"
              alignItems={isMobile ? 'center' : 'flex-start'}
              divider={<Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />}
              spacing={5}
            >
              {userAuthenticated === true && (
                <>
                  <Templates />
                  {recentDocuments.length > 0 && <Recent />}
                  <OpenOptions />
                </>
              )}
              {/* {userAuthenticated === false && <SampleSection />} */}
            </Stack>
          </Container>
        </Paper>
      )}
    </AnimatePresence>
  );
};

export default StoragePanel;
