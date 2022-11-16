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
import { getIcon } from '@src/assets/icons';
import { StyledToolTip } from '@src/components';
import { useAnalytics } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { BroadcastChannel } from 'broadcast-channel';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

export const Storage: FC = () => {
  const { user } = useAppState().auth;
  const { supportedProviders, storageProviders } = useAppState().providers;

  const { getLinkedAccounts, linkAccount } = useActions().auth;
  const { changePrefStorageProvider } = useActions().storage;
  const { notifyViaSnackbar } = useActions().ui;

  const { t } = useTranslation('storage');

  const { analytics } = useAnalytics();

  const handleStorageClick = async (providerId: string) => {
    if (storageProviders.length === 1) return;

    if (user?.prefStorageProvider === providerId) return;
    storageProviders.some((p) => p.providerId === providerId)
      ? changePrefStorageProvider(providerId)
      : await connectAccount(providerId);

    if (analytics) analytics.track('storage', { storage: providerId });
  };

  const connectAccount = async (provider: string) => {
    const linkAccountUrl = await linkAccount(provider);
    if (!linkAccountUrl) return;

    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.onmessage = async (linkAccountCallback) => {
      channel.close();

      if (!linkAccountCallback.success) {
        notifyViaSnackbar(`${t(`error:something_went_wrong`)}`);
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
          {supportedProviders.map(
            (provider) =>
              provider.storeToken && (
                <StyledToolTip
                  key={provider.providerId}
                  title={
                    !storageProviders.some((p) => p.providerId === provider.providerId)
                      ? t('commons:link_your_account', { provider: provider.providerId })
                      : user?.prefStorageProvider === provider.providerId
                      ? provider.providerId
                      : t('commons:switch_accounts', { provider: provider.providerId })
                  }
                >
                  <span>
                    <IconButton
                      key={provider.providerId}
                      onClick={() => handleStorageClick(provider.providerId)}
                      size="small"
                      sx={{
                        height: 22,
                        width: 22,
                        color: ({ palette }) =>
                          user?.prefStorageProvider === provider.providerId
                            ? palette.mode === 'dark'
                              ? palette.common.white
                              : palette.common.black
                            : 'inherit',
                        border: ({ palette }) =>
                          user?.prefStorageProvider === provider.providerId
                            ? `2px solid ${palette.primary.light}`
                            : 0,
                      }}
                    >
                      <Icon
                        component={getIcon(provider.providerId)}
                        sx={{
                          width: 16,
                          height: 16,
                          opacity: storageProviders.includes(provider) ? 1 : 0.3,
                        }}
                      />
                    </IconButton>
                  </span>
                </StyledToolTip>
              )
          )}
        </Stack>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
