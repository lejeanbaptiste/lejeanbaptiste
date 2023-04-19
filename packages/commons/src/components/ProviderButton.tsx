import { Button, Tooltip } from '@mui/material';
import { getIcon, type IconName } from '@src/icons';
import { useActions, useAppState } from '@src/overmind';
import { motion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ProviderButtonProps {
  name: string;
}

export const ProviderButton = ({ name: provider }: ProviderButtonProps) => {
  const { cookieConsent } = useAppState().ui;
  const { signIn } = useActions().auth;

  const { t } = useTranslation('LWC');

  const Icon = getIcon(provider as IconName);

  const singInClick = () => signIn({ idpHint: provider });

  return (
    <Tooltip
      title={
        !cookieConsent.includes('interaction')
          ? t('cookie_consent.warning.must_accept_cookies_message')
          : ''
      }
    >
      <span>
        <Button
          color="primary"
          disabled={!cookieConsent.includes('interaction')}
          fullWidth
          onClick={singInClick}
          size="large"
          startIcon={<Icon />}
          variant="contained"
          sx={{ width: 140, textTransform: 'capitalize' }}
          component={motion.button}
          whileTap={{ scale: 0.95 }}
        >
          {provider}
        </Button>
      </span>
    </Tooltip>
  );
};
