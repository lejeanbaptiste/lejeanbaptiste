import FingerprintIcon from '@mui/icons-material/Fingerprint';
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
import { useActions, useAppState } from '@src/overmind';
import { supportedIdentityProviders } from '@src/services';
import type { IdentityProvider } from '@src/types';
import { getIcon } from '@src/utilities/icons';
import { BroadcastChannel } from 'broadcast-channel';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const Identity: FC = () => {
  const { user } = useAppState().auth;
  const { changePrefferedID, getLinkedAccounts, linkAccount } = useActions().auth;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation();

  const handleIdClick = async (provider: IdentityProvider) => {
    if (!user || user?.prefferedID === provider) return;
    user.identities.get(provider) ? changePrefferedID(provider) : await connectAccount(provider);
  };

  const connectAccount = async (provider: string) => {
    const linkAccountUrl = await linkAccount(provider);
    if (!linkAccountUrl) return;

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
        <FingerprintIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        id="identity"
        primary={t('home:identity')}
        sx={{ textTransform: 'capitalize' }}
      />
      <ListItemSecondaryAction>
        <Stack direction="row" gap={1.5} mr={1}>
          {supportedIdentityProviders.map((provider) => (
            <Tooltip
              key={provider}
              title={
                !user?.identities.get(provider)
                  ? `Link your ${provider} account`
                  : provider === user?.prefferedID
                  ? provider
                  : `Switch to ${provider}`
              }
            >
              <span>
                <IconButton
                  disabled={supportedIdentityProviders.length === 1}
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
                      opacity: user?.identities.get(provider) ? 1 : 0.3,
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

export default Identity;
