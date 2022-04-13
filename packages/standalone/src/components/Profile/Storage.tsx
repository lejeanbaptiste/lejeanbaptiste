import SettingsSystemDaydreamIcon from '@mui/icons-material/SettingsSystemDaydream';
import {
  Icon,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Tooltip,
} from '@mui/material';
import type { StorageProvider } from '@src/@types/types';
import { useActions, useAppState } from '@src/overmind';
import { suportedStorageProviders } from '@src/services';
import { getIcon } from '@src/utilities/icons';
import { BroadcastChannel } from 'broadcast-channel';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const Storage: FC = () => {
  const { t } = useTranslation();
  const { user, storageProviders } = useAppState();
  const { changePrefStorageProvider, getLinkedAccounts, linkAccount, notifyViaSnackbar } =
    useActions();

  const handleStorageClick = async (provider: StorageProvider) => {
    if (user?.prefStorageProvider === provider) return;
    storageProviders.includes(provider)
      ? changePrefStorageProvider(provider)
      : await connectAccount(provider);
  };

  const connectAccount = async (provider: string) => {
    const linkAccountUrl = await linkAccount(provider);

    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.onmessage = async (linkAccountCallback) => {
      channel.close();

      if (!linkAccountCallback.success) {
        notifyViaSnackbar(t(`error:somethingWentWrong`));
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
        primary={t('home:storage')}
        sx={{ textTransform: 'capitalize' }}
      />
      <ListItemSecondaryAction>
        <Stack direction="row" gap={1.5} mr={1}>
          {suportedStorageProviders.map((provider) => (
            <Tooltip
              key={provider}
              title={
                !storageProviders.includes(provider) === undefined
                  ? `Link your ${provider} account`
                  : user?.prefStorageProvider === provider
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
            </Tooltip>
          ))}
        </Stack>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

export default Storage;
