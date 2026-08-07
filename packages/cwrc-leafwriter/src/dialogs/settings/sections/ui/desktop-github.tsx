import { Alert, Box, Button, Collapse, ListItem, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        githubConnected: boolean;
        connectGithub: (
          onStarted?: (userCode: string) => void,
        ) => Promise<{ ok: boolean; error?: string }>;
        disconnectGithub: () => Promise<void>;
      };
    }
  ).__ljbCommonsUi;

export const DesktopGithub = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [connected, setConnected] = useState(bridge?.githubConnected ?? false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (bridge) setConnected(bridge.githubConnected);
  }, [bridge?.githubConnected]);

  if (!bridge) return null;

  const connect = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      const result = await bridge.connectGithub((userCode) => {
        setMessage({
          severity: 'success',
          text: t('LW.settings.github.browser_code', { code: userCode }),
        });
      });
      if (result.ok) {
        setConnected(true);
        setMessage({ severity: 'success', text: t('LW.settings.github.connected') });
      } else {
        setMessage({
          severity: 'error',
          text: result.error ?? t('LW.settings.github.connect_failed'),
        });
      }
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : t('LW.settings.github.connect_failed'),
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      await bridge.disconnectGithub();
      setConnected(false);
      setMessage({ severity: 'success', text: t('LW.settings.github.disconnected') });
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : t('LW.settings.github.disconnect_failed'),
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', py: 0.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
          {t('LW.settings.github.description')}
        </Typography>
        <Stack spacing={0.75}>
          <Stack alignItems="center" direction="row" spacing={1}>
            <Button
              disabled={connecting || disconnecting}
              onClick={() => void connect()}
              size="small"
              variant="contained"
            >
              {connecting
                ? t('LW.settings.github.connecting')
                : connected
                  ? t('LW.settings.github.reconnect')
                  : t('LW.settings.github.connect')}
            </Button>
            {connected && (
              <Button
                disabled={connecting || disconnecting}
                onClick={() => void disconnect()}
                size="small"
                variant="outlined"
              >
                {disconnecting
                  ? t('LW.settings.github.disconnecting')
                  : t('LW.settings.github.disconnect')}
              </Button>
            )}
          </Stack>
          <Collapse in={Boolean(message)}>
            {message ? (
              <Alert severity={message.severity} sx={{ py: 0 }}>
                {message.text}
              </Alert>
            ) : null}
          </Collapse>
        </Stack>
      </Box>
    </ListItem>
  );
};
