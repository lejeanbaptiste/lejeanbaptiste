import SettingsSystemDaydreamIcon from '@mui/icons-material/SettingsSystemDaydream';
import {
  Icon,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
} from '@mui/material';
import { StyledToolTip } from '@src/components';
import { useAnalytics } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { suportedStorageProviders, type StorageProviderName } from '@src/services';
import { getIcon } from '@src/utilities';
import { BroadcastChannel } from 'broadcast-channel';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

export const Storage: FC = () => {
  const { user } = useAppState().auth;
  const { storageProviders } = useAppState().storage;

  const { getLinkedAccounts, linkAccount } = useActions().auth;
  const { changePrefStorageProvider } = useActions().storage;
  const { notifyViaSnackbar } = useActions().ui;

  const { t } = useTranslation('storage');

  const { analytics } = useAnalytics();

  const handleStorageClick = async (provider: StorageProviderName) => {
    if (suportedStorageProviders.length === 1) return;

    if (user?.prefStorageProvider === provider) return;
    storageProviders.includes(provider)
      ? changePrefStorageProvider(provider)
      : await connectAccount(provider);

    if (analytics) analytics.track('storage', { storage: provider });
  };

  const connectAccount = async (provider: string) => {
    const linkAccountUrl = await linkAccount(provider);
    if (!linkAccountUrl) return;

    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.onmessage = async (linkAccountCallback) => {
      channel.close();

      if (!linkAccountCallback.success) {
        notifyViaSnackbar(t(`error:Something went wrong`));
        return;
      }

      await getLinkedAccounts();
      notifyViaSnackbar('Account Linked');
    };

    window.open(linkAccountUrl);
  };

  return (
    <ListItem dense>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <SettingsSystemDaydreamIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        id="identity"
        primary={t('commons:storage')}
        sx={{ textTransform: 'capitalize' }}
      />
      <ListItemSecondaryAction>
        <Stack direction="row" gap={1.5} mr={1}>
          {suportedStorageProviders.map((provider) => (
            <StyledToolTip
              key={provider}
              title={
                !storageProviders.includes(provider) === undefined
                  ? t('link your account', { account: provider })
                  : user?.prefStorageProvider === provider
                  ? provider
                  : t('switch account', { account: provider })
              }
            >
              <span>
                <IconButton
                  key={provider}
                  onClick={() => handleStorageClick(provider)}
                  size="small"
                  sx={{
                    height: 22,
                    width: 22,
                    color: ({ palette }) =>
                      user?.prefStorageProvider === provider
                        ? palette.mode === 'dark'
                          ? palette.common.white
                          : palette.common.black
                        : 'inherit',
                    border: ({ palette }) =>
                      user?.prefStorageProvider === provider
                        ? `2px solid ${palette.primary.light}`
                        : 0,
                  }}
                >
                  <Icon
                    component={getIcon(provider)}
                    sx={{
                      width: 16,
                      height: 16,
                      opacity: storageProviders.includes(provider) ? 1 : 0.3,
                    }}
                  />
                </IconButton>
              </span>
            </StyledToolTip>
          ))}
        </Stack>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
