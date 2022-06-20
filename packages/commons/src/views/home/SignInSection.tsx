import { Box, Button } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const SignInSection: FC = () => {
  const { userState } = useAppState().auth;
  const { signIn } = useActions().auth;

  const { t } = useTranslation();

  const handleClick = () => signIn();

  const conainerVariants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  return (
    <AnimatePresence>
      {userState === 'UNAUTHENTICATED' && (
        <Box
          component={motion.div}
          variants={conainerVariants}
          initial="initial"
          animate="visible"
          exit="exit"
          display="flex"
          justifyContent="center"
          py={6}
        >
          <Button
            disableElevation
            onClick={handleClick}
            size="large"
            variant="contained"
            sx={{ width: 150 }}
          >
            {t('home:signin')}
          </Button>
        </Box>
      )}
    </AnimatePresence>
  );
};

export default SignInSection;
