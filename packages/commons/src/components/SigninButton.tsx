import { Button, Tooltip, Typography } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

export const SigninButton: FC = () => {
  const { cookieConsent } = useAppState().ui;
  const { isDirty } = useAppState().editor;

  const { openDialog } = useActions().ui;

  const { t } = useTranslation('storage');

  const handleClick = () => {
    if (!isDirty) return openDialog({ type: 'signIn' });

    openDialog({
      props: {
        severity: 'warning',
        title: t('commons:unsaved_changes'),
        Message: () => <Typography>{t('storage:you_will_lose_any_unsaved_changes')}.</Typography>,
        actions: [
          { action: 'cancel', label: t('commons:cancel') },
          { action: 'signin', label: t('commons:sign_in'), variant: 'outlined' },
        ],
        //@ts-ignore
        onClose: async (action: string) => {
          if (action === 'cancel') return;
          openDialog({ type: 'signIn' });
        },
      },
    });
  };

  return (
    <Tooltip
      title={
        !cookieConsent.includes('interaction')
          ? t('cookie_consent:warning.must_accept_cookies_message')
          : ''
      }
    >
      <span>
        <Button
          disabled={!cookieConsent.includes('interaction')}
          id="signin-button"
          onClick={handleClick}
          size="small"
          sx={{ width: 'max-content' }}
          variant="contained"
        >
          {t('commons:sign_in')}
        </Button>
      </span>
    </Tooltip>
  );
};
