import AddLinkIcon from '@mui/icons-material/AddLink';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import {
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { StyledToolTip } from '@src/components';
import { supportedStorageProviders } from '@src/config';
import { useAnalytics } from '@src/hooks';
import { getIcon, type IconName } from '@src/icons';
import { useActions, useAppState } from '@src/overmind';
import { BroadcastChannel } from 'broadcast-channel';
import chroma from 'chroma-js';
import React, { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { type SubMenu } from './';

export const Storage = ({ onBack, onClose }: SubMenu) => {
  const { user } = useAppState().auth;
  const { supportedProviders } = useAppState().providers;

  const { getLinkedAccounts, linkAccount } = useActions().auth;
  const { setPrefStorageProvider } = useActions().storage;
  const { notifyViaSnackbar } = useActions().ui;

  const { t } = useTranslation('storage');

  const { analytics } = useAnalytics();

  const handleSelect = async (event: MouseEvent, id: string) => {
    event.stopPropagation();

    if (user?.prefStorageProvider === id) return;
    setPrefStorageProvider(id);

    if (analytics) analytics.track('storage', { storage: id });
    onClose();
  };

  const handleLinkAccount = async (id: string) => {
    const linkAccountUrl = await linkAccount(id);
    if (!linkAccountUrl) return;

    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.onmessage = async (linkAccountCallback) => {
      channel.close();

      if (!linkAccountCallback.success) {
        notifyViaSnackbar(`${t(`error:something_went_wrong`)}`);
        return;
      }

      await getLinkedAccounts();

      if (!user?.prefStorageProvider) {
        setPrefStorageProvider(id);
        if (analytics) analytics.track('storage', { storage: id });
      }

      notifyViaSnackbar('Account Linked');
    };

    window.open(linkAccountUrl);
  };

  return (
    <List dense disablePadding sx={{ width: 300 }}>
      <ListItem sx={{ px: 1.75 }}>
        <IconButton onClick={() => onBack()} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <ListItemText primary={t('commons:storage')} sx={{ textTransform: 'capitalize' }} />
      </ListItem>
      {supportedProviders
        .filter((provider) => supportedStorageProviders.includes(provider.providerId))
        .map(({ providerId: id, service }) => (
          <ListItem
            key={id}
            color="primary"
            secondaryAction={
              !service && (
                <StyledToolTip arrow title={t('commons:link_your_account', { provider: id })}>
                  <IconButton onClick={() => handleLinkAccount(id)} size="small">
                    <AddLinkIcon color="primary" fontSize="small" />
                  </IconButton>
                </StyledToolTip>
              )
            }
            sx={{ px: 0.5 }}
          >
            <ListItemButton
              disabled={!service}
              onClick={(event) => handleSelect(event, id)}
              selected={user?.prefStorageProvider === id}
              sx={{
                borderRadius: 1,
                '&.Mui-selected': {
                  bgcolor: ({ palette }) =>
                    user?.prefStorageProvider === id
                      ? chroma(palette.primary.main).alpha(0.15).css()
                      : 'inherit',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Icon
                  color={user?.prefStorageProvider === id ? 'primary' : 'inherit'}
                  component={getIcon(id as IconName)}
                  fontSize="small"
                />
              </ListItemIcon>
              <ListItemText primary={id} sx={{ textTransform: 'capitalize' }} />
              {user?.prefStorageProvider === id && <CheckIcon color="primary" fontSize="small" />}
            </ListItemButton>
          </ListItem>
        ))}
    </List>
  );
};
