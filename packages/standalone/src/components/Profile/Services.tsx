import IosShareIcon from '@mui/icons-material/IosShare';
import { Button, Icon, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import Notification from '@src/components/Notification';
import { useActions, useAppState } from '@src/overmind';
import { suportedStorageProviders, supportedIdentityProviders } from '@src/services';
import { getIcon } from '@src/utilities/icons';
import { BroadcastChannel } from 'broadcast-channel';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface NotifyProps {
  message: string;
  open: boolean;
}

const ACCOUNT_MANAGMENT_URL =
  'https://keycloak.sandbox.lincsproject.ca/auth/realms/lincs/account/#/';

const Services: FC = () => {
  const { t } = useTranslation();

  const { user, prefStorageProvider, storageProviders } = useAppState();
  const actions = useActions();

  const [notify, setNotify] = useState<NotifyProps>({ message: '', open: false });

  const handleIdClick = async (provider: string) => {
    if (user?.prefferedID === provider) return;
    if (user?.identities[provider]) actions.changePrefferedID(provider);
    if (user?.identities[provider] === undefined) await connectAccount(provider);
  };

  const handleStorageClick = async (provider: string) => {
    if (prefStorageProvider === provider) return;
    if (storageProviders[provider]) actions.changePrefStorageProvider(provider);
    if (storageProviders[provider] === undefined) await connectAccount(provider);
  };

  const connectAccount = async (provider: string) => {
    const linkAccountUrl = await actions.linkAccount(provider);

    const channel = new BroadcastChannel('CWRC-Writer-Link-Accounts');
    channel.onmessage = async (linkAccountCallback) => {
      channel.close();

      if (!linkAccountCallback.success) {
        return setNotify({ message: t(`error:somethingWentWrong`), open: true });
      }

      await actions.getLinkedAccounts();
      setNotify({ message: 'Account Linked', open: true });
    };

    window.open(linkAccountUrl);
  };

  const handleCloseNotification = () => {
    setNotify({ message: '', open: false });
  };

  return (
    <Stack
      spacing={1}
      width="100%"
      p={2}
      sx={{ background: ({ palette }) => (palette.mode === 'dark' ? 'inherent' : '#f9f9f9') }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
          {t('home:identity')}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {supportedIdentityProviders.map((provider) => (
            <Tooltip
              arrow={true}
              key={provider}
              placement="top"
              sx={{ mb: 0, textTransform: 'capitalize' }} //? needs to reach deeper to do this transformations
              title={
                user?.identities[provider] === undefined
                  ? `Link your ${provider} account`
                  : provider === user?.prefferedID
                  ? provider
                  : `Switch to ${provider}`
              }
            >
              <span>
                <IconButton
                  // disabled={supportedIdentityProviders.length === 1}
                  onClick={() => handleIdClick(provider)}
                  size="small"
                  sx={{
                    height: 22,
                    width: 22,
                    color: ({ palette }) =>
                      user?.prefferedID === provider
                        ? palette.mode === 'dark'
                          ? palette.common.white
                          : palette.common.black
                        : 'inherit',
                    border: ({ palette }) =>
                      user?.prefferedID === provider ? `2px solid ${palette.primary.light}` : 0,
                  }}
                >
                  <Icon
                    component={getIcon(provider)}
                    sx={{
                      width: 16,
                      height: 16,
                      opacity: user?.identities[provider] ? 1 : 0.3,
                    }}
                  />
                </IconButton>
              </span>
            </Tooltip>
          ))}
        </Stack>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%">
        <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
          {t('home:storage')}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {suportedStorageProviders.map((provider) => (
            <Tooltip
              key={provider}
              placement="top"
              sx={{ mb: 0, textTransform: 'capitalize' }} //? needs to reach deeper to do this transformations
              title={
                storageProviders[provider] === undefined
                  ? `Link your ${provider} account`
                  : prefStorageProvider === provider
                  ? provider
                  : `Switch to ${provider}`
              }
            >
              <span>
                <IconButton
                  key={provider}
                  // disabled={suportedStorageProviders.length === 1}
                  onClick={() => handleStorageClick(provider)}
                  size="small"
                  sx={{
                    height: 22,
                    width: 22,
                    color: ({ palette }) =>
                      prefStorageProvider === provider
                        ? palette.mode === 'dark'
                          ? palette.common.white
                          : palette.common.black
                        : 'inherit',
                    border: ({ palette }) =>
                      prefStorageProvider === provider ? `2px solid ${palette.primary.light}` : 0,
                  }}
                >
                  <Icon
                    component={getIcon(provider)}
                    sx={{
                      width: 16,
                      height: 16,
                      opacity: storageProviders[provider] ? 1 : 0.3,
                    }}
                  />
                </IconButton>
              </span>
            </Tooltip>
          ))}
        </Stack>
      </Stack>
      <Button
        color="inherit"
        endIcon={
          <IosShareIcon sx={{ width: 16, height: 16, mt: 0.25, transform: 'rotate(90deg)' }} />
        }
        size="small"
        sx={{ mb: 1, fontSize: '0.7125rem' }}
        target="_blank"
        href={ACCOUNT_MANAGMENT_URL}
      >
        Manage your Lincs account
      </Button>
      <Notification message={notify.message} onClose={handleCloseNotification} open={notify.open} />
    </Stack>
  );
};

export default Services;
