import { Box, Button, Stack } from '@mui/material';
import { analytics } from '@src/analytics';
import { useActions, useAppState } from '@src/overmind';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getIcon } from '@src/utilities/icons';
import GitHubIcon from '@mui/icons-material/GitHub';
import { supportedAuthProviders } from '@src/services';

const SignInSection: FC = () => {
  const { userState, user } = useAppState().auth;
  const { signIn } = useActions().auth;

  useEffect(() => {
    if (userState === 'AUTHENTICATED' && user) {
      analytics.identify(user.username);
    }
  }, [userState]);

  const { t } = useTranslation();

  const singInClick = (idpHint: string) => {
    signIn({ idpHint });
  };

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
          <Stack gap={2}>
            {supportedAuthProviders.map((provider) => {
              const Icon = getIcon(provider);
              return (
                <Button
                  key={provider}
                  color="primary"
                  onClick={() => singInClick(provider)}
                  size="large"
                  startIcon={<Icon />}
                  variant="contained"
                  sx={{
                    width: 280,
                    fontSize: '1.05rem',
                    letterSpacing: '0.01rem',
                    textTransform: 'initial',
                  }}
                >
                  {t(`home:signinWith-${provider}`)}
                </Button>
              );
            })}
          </Stack>
        </Box>
      )}
    </AnimatePresence>
  );
};

export default SignInSection;
