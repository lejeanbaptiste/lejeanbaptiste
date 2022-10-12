import { Box, Button, Divider, List, Popover, Typography } from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { suportedStorageProviders, supportedIdentityProviders } from '@src/services';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorSettings } from './EditorSettings';
import { Footer } from './Footer';
import { Identity } from './Identity';
import { Language } from './Language';
import { PrivacySettings } from './PrivacySettings';
import { Storage } from './Storage';
import { ThemeAppearance } from './ThemeAppearance';
import { UserCard } from './UserCard';

interface ProfileProps {
  anchor: HTMLDivElement;
  onClose: () => void;
}

export const Profile: FC<ProfileProps> = ({ anchor, onClose }) => {
  const { isDirty, libLoaded } = useAppState().editor;

  const { signOut } = useActions().auth;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('commons');
  const { clearCookieConsent } = useCookieConsent();

  const open = Boolean(anchor);

  const handleSignOut = async () => {
    if (!isDirty) doSignOut();

    openDialog({
      props: {
        severity: 'warning',
        title: t('commons:unsaved_changes'),
        Message: () => <Typography>{t('storage:you_will_lose_any_unsaved_changes')}.</Typography>,
        actions: [
          { action: 'cancel', label: t('commons:cancel') },
          { action: 'signout', label: t('commons:sign_out'), variant: 'outlined' },
        ],
        //@ts-ignore
        onClose: async (action: string) => {
          if (action === 'cancel') return onClose();
          doSignOut();
        },
      },
    });
  };

  const doSignOut = async () => {
    clearCookieConsent();
    await signOut();
    onClose();
  };

  const handleClose = async (event: MouseEvent, reason?: string) => {
    event.stopPropagation();
    onClose();
  };

  return (
    <Popover
      anchorEl={anchor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      id="profile"
      onClose={handleClose}
      open={open}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <UserCard />

      <Divider />

      <List sx={{ width: 280 }}>
        {supportedIdentityProviders.length > 1 && <Identity />}
        {suportedStorageProviders.length > 1 && <Storage />}
        <ThemeAppearance />
        <Language />
      </List>

      <Divider />

      <PrivacySettings onClick={onClose} />
      {libLoaded && <EditorSettings onClick={onClose} />}

      <Divider />

      <Box display="flex" justifyContent="center" mt={2} mb={2}>
        <Button
          onClick={handleSignOut}
          size="small"
          sx={{ ':first-letter': { textTransform: 'uppercase' } }}
          variant="outlined"
        >
          {t('sign out')}
        </Button>
      </Box>

      <Divider />
      <Footer onClick={onClose} />
    </Popover>
  );
};
