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
  useTheme,
} from '@mui/material';
import { StyledToolTip } from '@src/components';
import { supportedIdentityProviders } from '@src/config';
import { useAnalytics } from '@src/hooks';
import { getIcon, type IconName } from '@src/icons';
import { useActions, useAppState } from '@src/overmind';
import { BroadcastChannel } from 'broadcast-channel';
import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubMenu } from '../types';

export const Identity = ({ onBack, onClose }: SubMenu) => {
  const theme = useTheme();
  const { user } = useAppState().auth;
  const { setPreferredId, getLinkedAccounts, linkAccount } = useActions().auth;
  const { supportedProviders, storageProviders } = useAppState().providers;

  const { setPrefStorageProvider } = useActions().storage;
  const { notifyViaSnackbar } = useActions().ui;

  const { t } = useTranslation();
  const { analytics } = useAnalytics();

  const handleSelect = async (event: MouseEvent, id: string) => {
    event.stopPropagation();
    if (!user || user?.preferredID === id) return;

    setPreferredId(id);
    onClose();
  };

  const handleConnectAccount = async (id: string) => {
    const linkAccountUrl = await linkAccount(id);
    if (!linkAccountUrl) return;

    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.onmessage = async (linkAccountCallback) => {
      channel.close();

      if (!linkAccountCallback.success) {
        notifyViaSnackbar(`${t(`LWC.error.something_went_wrong`)}`);
        return;
      }

      await getLinkedAccounts();

      if (
        !user?.prefStorageProvider &&
        storageProviders.some((provider) => provider.providerId === id)
      ) {
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
        <IconButton onPointerDown={() => onBack()} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <ListItemText primary={t('LWC.commons.identity')} sx={{ textTransform: 'capitalize' }} />
      </ListItem>
      {supportedProviders
        .filter(
          (provider) =>
            provider.providerId && supportedIdentityProviders.includes(provider.providerId),
        )
        .map(({ providerId, service }) => (
          <ListItem
            key={providerId}
            color="primary"
            secondaryAction={
              !service &&
              providerId && (
                <StyledToolTip
                  arrow
                  title={t('LWC.commons.link_your_account', { provider: providerId })}
                >
                  <IconButton onPointerDown={() => handleConnectAccount(providerId)} size="small">
                    <AddLinkIcon color="primary" fontSize="small" />
                  </IconButton>
                </StyledToolTip>
              )
            }
            sx={{ px: 0.5 }}
          >
            <ListItemButton
              disabled={!service}
              onPointerDown={(event) => providerId && handleSelect(event, providerId)}
              selected={providerId === user?.preferredID}
              sx={[
                { borderRadius: 1 },
                user?.preferredID === providerId && {
                  '&.Mui-selected': {
                    backgroundColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.15)`,
                  },
                },
              ]}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Icon
                  color={user?.preferredID === providerId ? 'primary' : 'inherit'}
                  component={getIcon(providerId as IconName)}
                  fontSize="small"
                />
              </ListItemIcon>
              <ListItemText primary={providerId} sx={{ textTransform: 'capitalize' }} />
              {user?.preferredID === providerId && <CheckIcon color="primary" fontSize="small" />}
            </ListItemButton>
          </ListItem>
        ))}
    </List>
  );
};
