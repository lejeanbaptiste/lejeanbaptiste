import {
  Alert,
  Box,
  Button,
  LinearProgress,
  ListItem,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

type ChgisInstallProgress = {
  phase: 'extracting' | 'compiling' | 'idle';
  message: string;
};

type ChgisStatus = {
  installed: boolean;
  entityDbFolder: string | null;
  entityDbReady: boolean;
  layers?: string[];
  placeCount?: number;
  crosswalkCount?: number;
  installedAt?: string;
  diskBytes?: number;
  lastError?: string;
  busy: boolean;
};

type ChgisInstallResult = { ok: boolean; error?: string; placeCount?: number };

const CHGIS_ATTRIBUTION =
  'CHGIS, Version 6. (c) Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.';

const CHGIS_LICENSE_NOTICE =
  'CHGIS data is free for academic research. Commercial use, resale, and redistribution are not permitted. You must download from Harvard Dataverse and compile locally.';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const DesktopChgisAuthorities = () => {
  const [status, setStatus] = useState<ChgisStatus | null>(null);
  const [progress, setProgress] = useState<ChgisInstallProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    severity: 'error' | 'info' | 'success';
    text: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const next = await window.electronAPI?.authorityChgisGet?.();
    if (next) setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
    const api = window.electronAPI;
    if (!api?.onAuthorityChgisProgress) return;
    return api.onAuthorityChgisProgress((next) => setProgress(next));
  }, [refresh]);

  const handleInstall = async () => {
    setMessage(null);
    const archivePath = await window.electronAPI?.pickChgisArchive?.();
    if (!archivePath) return;

    setBusy(true);
    try {
      const result: ChgisInstallResult =
        (await window.electronAPI?.authorityChgisInstallFromArchive?.(archivePath)) ?? {
          ok: false,
          error: 'CHGIS install is unavailable in this build.',
        };
      if (!result.ok) {
        setMessage({ severity: 'error', text: result.error ?? 'CHGIS install failed.' });
      } else {
        setMessage({
          severity: 'success',
          text: `CHGIS places compiled (${result.placeCount?.toLocaleString() ?? 'ready'} records). Enable “CHGIS historical places” in the auto-tag dialog.`,
        });
      }
      await refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleRemove = async () => {
    setMessage(null);
    const response = await window.electronAPI?.showNativeMessageBox?.({
      type: 'question',
      title: 'Remove CHGIS data',
      message: 'Delete compiled CHGIS pack and raw download from this entity database?',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
    });
    if (!response || response.response !== 1) return;

    setBusy(true);
    try {
      const result = await window.electronAPI?.authorityChgisRemove?.();
      if (!result?.ok) {
        setMessage({ severity: 'error', text: result?.error ?? 'Could not remove CHGIS data.' });
      } else {
        setMessage({ severity: 'info', text: 'CHGIS data removed.' });
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const working = busy || status?.busy;

  return (
    <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', px: 0, py: 1.5 }}>
      <Stack spacing={1.5} width="100%">
        <Box>
          <Typography variant="subtitle2">CHGIS historical places (optional)</Typography>
          <Typography variant="body2" color="text.secondary">
            Download from{' '}
            <a href="https://dataverse.harvard.edu/dataverse/chgis_v6" target="_blank" rel="noreferrer">
              Harvard Dataverse
            </a>
            , then install here. LEAF-Writer compiles a local pack only — nothing is redistributed.
          </Typography>
        </Box>

        <Alert severity="info" sx={{ py: 0.5 }}>
          {CHGIS_LICENSE_NOTICE}
        </Alert>

        {!status?.entityDbReady && (
          <Alert severity="warning">
            Choose an entity database folder (with entities.xml) in App Settings before installing
            CHGIS.
          </Alert>
        )}

        {status?.entityDbReady && (
          <Stack spacing={0.75}>
            <Typography variant="body2" color="text.secondary">
              Status:{' '}
              {status.installed
                ? `installed · ${status.placeCount?.toLocaleString() ?? '?'} places`
                : 'not installed'}
              {status.diskBytes ? ` · ${formatBytes(status.diskBytes)} on disk` : ''}
            </Typography>
            {status.layers?.length ? (
              <Typography variant="caption" color="text.secondary">
                Layers: {status.layers.join(', ')}
              </Typography>
            ) : null}
            {status.crosswalkCount ? (
              <Typography variant="caption" color="text.secondary">
                CBDB crosswalks: {status.crosswalkCount.toLocaleString()}
              </Typography>
            ) : null}
            {status.installedAt && (
              <Typography variant="caption" color="text.secondary">
                Installed: {new Date(status.installedAt).toLocaleString()}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {CHGIS_ATTRIBUTION}
            </Typography>
          </Stack>
        )}

        {progress && working && (
          <Box>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {progress.message}
            </Typography>
          </Box>
        )}

        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        {status?.lastError && !message && <Alert severity="error">{status.lastError}</Alert>}

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            disabled={working || !status?.entityDbReady}
            onClick={() => void handleInstall()}
          >
            {status?.installed ? 'Reinstall from download…' : 'Install from download…'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={working || !status?.installed}
            onClick={() => void handleRemove()}
          >
            Remove
          </Button>
          <Button size="small" variant="text" disabled={working} onClick={() => void refresh()}>
            Refresh
          </Button>
        </Stack>
      </Stack>
    </ListItem>
  );
};
