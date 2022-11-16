import FingerprintIcon from '@mui/icons-material/Fingerprint';
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
import { useActions, useAppState } from '@src/overmind';
import { BroadcastChannel } from 'broadcast-channel';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

export const Identity: FC = () => {
  const { user } = useAppState().auth;
  const { setPreferredId: changePreferredID, getLinkedAccounts, linkAccount } = useActions().auth;
  const { supportedProviders } = useAppState().providers;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation('profile');

  const handleIdClick = async (provider: string) => {
    if (supportedProviders.length === 1) return;

    if (!user || user?.preferredID === provider) return;
    user.identities.get(provider) ? changePreferredID(provider) : await connectAccount(provider);
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
        <FingerprintIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        id="identity"
        primary={t('commons:identity')}
        sx={{ textTransform: 'capitalize' }}
      />
      <ListItemSecondaryAction>
        <Stack direction="row" gap={1.5} mr={1}>
          {supportedProviders.map(({ providerId }) => (
            <StyledToolTip
              key={providerId}
              title={
                !user?.identities.get(providerId)
                  ? t('commons:link_your_account', { provider: providerId })
                  : providerId === user?.preferredID
                  ? providerId
                  : t('commons:switch_accounts', { provider: providerId })
              }
            >
              <span>
                <IconButton
                  onClick={() => handleIdClick(providerId)}
                  size="small"
                  sx={{
                    height: 22,
                    width: 22,
                    color: ({ palette }) =>
                      user?.preferredID === providerId ? palette.primary.main : 'inherit',
                    border: ({ palette }) =>
                      user?.preferredID === providerId ? `2px solid ${palette.primary.light}` : 0,
                  }}
                >
                  <Icon
                    component={getIcon(providerId)}
                    sx={{
                      width: 16,
                      height: 16,
                      opacity: user?.identities.has(providerId) ? 1 : 0.7,
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
