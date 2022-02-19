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
import type { IdentityProvider } from '@src/@types/types';
import { useActions, useAppState } from '@src/overmind';
import { supportedIdentityProviders } from '@src/services';
import { getIcon } from '@src/utilities/icons';
import { BroadcastChannel } from 'broadcast-channel';
import { useSnackbar } from 'notistack';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const Identity: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const { user } = useAppState();
  const actions = useActions();

  const handleIdClick = async (provider: IdentityProvider) => {
    if (user?.prefferedID === provider) return;
    user?.identities[provider]
      ? actions.changePrefferedID(provider)
      : await connectAccount(provider);
  };

  const connectAccount = async (provider: string) => {
    const linkAccountUrl = await actions.linkAccount(provider);

    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.onmessage = async (linkAccountCallback) => {
      channel.close();

      if (!linkAccountCallback.success) enqueueSnackbar(t(`error:somethingWentWrong`));

      await actions.getLinkedAccounts();
      enqueueSnackbar('Account Linked');
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
                user?.identities[provider] === undefined
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
                      opacity: user?.identities[provider] ? 1 : 0.3,
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
