import { Box, Button, Stack, Tooltip } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { supportedAuthProviders } from '@src/services';
import { getIcon } from '@src/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

export const SignInSection: FC = () => {
  const { userState } = useAppState().auth;
  const { cookieConsent } = useAppState().ui;

  const { signIn } = useActions().auth;

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
                <Tooltip
                  key={provider}
                  title={
                    !cookieConsent.includes('interaction')
                      ? t('cookieConsent:warning:mustAcceptCookies_message')
                      : ''
                  }
                >
                  <span>
                    <Button
                      key={provider}
                      color="primary"
                      disabled={!cookieConsent.includes('interaction')}
                      onClick={() => singInClick(provider)}
                      size="large"
                      startIcon={<Icon />}
                      variant="contained"
                      sx={{
                        width: 280,
                        fontSize: '1.05rem',
                        letterSpacing: '0.01rem',
                        textTransform: 'capitalize',
                      }}
                    >
                      {t('sign in with provider', { provider })}
                    </Button>
                  </span>
                </Tooltip>
              );
            })}
          </Stack>
        </Box>
      )}
    </AnimatePresence>
  );
};
