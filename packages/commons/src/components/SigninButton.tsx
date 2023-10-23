import { Button, Tooltip, Typography } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { useTranslation } from 'react-i18next';

export const SigninButton = () => {
  const { cookieConsent } = useAppState().ui;
  const { contentHasChanged: isDirty } = useAppState().editor;

  const { openDialog } = useActions().ui;

  const { t } = useTranslation('LWC');

  const handleClick = () => {
    if (!isDirty) return openDialog({ type: 'signIn' });

    openDialog({
      props: {
        severity: 'warning',
        title: `${t('LWC:commons.unsaved_changes')}`,
        Body: () => <Typography>{t('LWC:storage.you_will_lose_any_unsaved_changes')}.</Typography>,
        actions: [
          { action: 'cancel', label: `${t('LWC:commons.cancel')}` },
          { action: 'signin', label: `${t('LWC:commons.sign_in')}`, variant: 'outlined' },
        ],
        onClose: async (action) => {
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
          ? t('LWC:cookie_consent.warning.must_accept_cookies_message')
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
          {t('LWC:commons.sign_in')}
        </Button>
      </span>
    </Tooltip>
  );
};
