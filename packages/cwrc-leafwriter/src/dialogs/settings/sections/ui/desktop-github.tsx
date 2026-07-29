import { Alert, Box, Button, Collapse, ListItem, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

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
          text: `GitHub opened in your browser. Enter the code ${userCode} to authorize LJB.`,
        });
      });
      if (result.ok) {
        setConnected(true);
        setMessage({ severity: 'success', text: 'GitHub connected.' });
      } else {
        setMessage({ severity: 'error', text: result.error ?? 'Could not connect to GitHub.' });
      }
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Could not connect to GitHub.',
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
      setMessage({ severity: 'success', text: 'GitHub disconnected.' });
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Could not disconnect from GitHub.',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', py: 0.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
          Connect your GitHub account to publish leaderboard stats. LJB will also use this
          connection for issue, pull request, and commit statistics.
        </Typography>
        <Stack spacing={0.75}>
          <Stack alignItems="center" direction="row" spacing={1}>
            <Button
              disabled={connecting || disconnecting}
              onClick={() => void connect()}
              size="small"
              variant="contained"
            >
              {connecting ? 'Connecting…' : connected ? 'Reconnect GitHub' : 'Connect GitHub'}
            </Button>
            {connected && (
              <Button
                disabled={connecting || disconnecting}
                onClick={() => void disconnect()}
                size="small"
                variant="outlined"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
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
