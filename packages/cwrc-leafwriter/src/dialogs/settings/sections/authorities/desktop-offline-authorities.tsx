import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  ListItem,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type AuthorityLifecycleProgress = {
  phase: 'compiling' | 'downloading' | 'extracting' | 'idle';
  message: string;
};

type AuthorityLifecycleStatus = {
  busy: boolean;
  enabled: boolean;
  profile: 'chinese' | 'japanese' | 'tibetan';
  label: string;
  entityDbFolder: string | null;
  entityDbReady: boolean;
  lastCheckAt?: string;
  lastError?: string;
  packBundleVersion?: string;
  packs: { id: string; installed: boolean }[];
  packsReady: boolean;
  rawSources: { id: string; installed: boolean; label: string; version?: string }[];
  updateAvailable: boolean;
  diskUsage: { packBytes: number; rawBytes: number } | null;
};

type AuthorityLifecycleRunResult = { ok: boolean; error?: string };

type CommonsUiBridge = {
  authorityLifecycleStatus: AuthorityLifecycleStatus | null;
  refreshAuthorityLifecycle: () => Promise<void>;
  setAuthorityLifecycleEnabled: (options: {
    enabled: boolean;
    profile?: 'chinese' | 'japanese' | 'tibetan';
    deleteFiles?: boolean;
  }) => Promise<AuthorityLifecycleRunResult>;
  runAuthorityLifecycleUpdate: () => Promise<AuthorityLifecycleRunResult>;
  revealAuthorityLifecycleFolder: () => Promise<void>;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getBridge = (): CommonsUiBridge | undefined =>
  (window as Window & { __ljbCommonsUi?: CommonsUiBridge }).__ljbCommonsUi;

export const DesktopOfflineAuthorities = () => {
  const { t } = useTranslation();
  const bridge = getBridge();
  const [status, setStatus] = useState<AuthorityLifecycleStatus | null>(
    bridge?.authorityLifecycleStatus ?? null,
  );
  const [progress, setProgress] = useState<AuthorityLifecycleProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    severity: 'error' | 'info' | 'success';
    text: string;
  } | null>(null);

  useEffect(() => {
    const sync = () => setStatus(getBridge()?.authorityLifecycleStatus ?? null);
    sync();
    window.addEventListener('ljbCommonsUiChanged', sync);
    return () => window.removeEventListener('ljbCommonsUiChanged', sync);
  }, []);

  useEffect(() => {
    if (!bridge) return;
    const api = (
      window as Window & {
        electronAPI?: {
          onAuthorityLifecycleProgress?: (
            callback: (progress: AuthorityLifecycleProgress) => void,
          ) => () => void;
        };
      }
    ).electronAPI;
    if (!api?.onAuthorityLifecycleProgress) return;
    return api.onAuthorityLifecycleProgress((next) => setProgress(next));
  }, [bridge]);

  const refresh = useCallback(async () => {
    await getBridge()?.refreshAuthorityLifecycle();
    setStatus(getBridge()?.authorityLifecycleStatus ?? null);
  }, []);

  if (!bridge) return null;

  const handleEnableChange = async (enabled: boolean) => {
    setMessage(null);
    if (!enabled) {
      const disk = status?.diskUsage;
      const totalBytes = disk ? disk.rawBytes + disk.packBytes : 0;
      const detail =
        totalBytes > 0
          ? t('LW.settings.authorities.offline.delete_detail_with_bytes', {
              bytes: formatBytes(totalBytes),
            })
          : t('LW.settings.authorities.offline.delete_detail');

      const response = await (
        window as Window & {
          electronAPI?: {
            showNativeMessageBox?: (options: {
              type: string;
              title: string;
              message: string;
              detail?: string;
              buttons: string[];
              defaultId?: number;
              cancelId?: number;
            }) => Promise<{ response: number }>;
          };
        }
      ).electronAPI?.showNativeMessageBox?.({
        type: 'question',
        title: t('LW.settings.authorities.offline.disable_title'),
        message: t('LW.settings.authorities.offline.disable_message'),
        detail,
        buttons: [
          t('LW.settings.authorities.offline.keep_files'),
          t('LW.settings.authorities.offline.delete_files'),
          t('LW.commons.cancel'),
        ],
        defaultId: 0,
        cancelId: 2,
      });

      if (!response || response.response === 2) return;

      setBusy(true);
      try {
        const result = await bridge.setAuthorityLifecycleEnabled({
          enabled: false,
          profile: status?.profile,
          deleteFiles: response.response === 1,
        });
        if (!result.ok) {
          setMessage({ severity: 'error', text: result.error ?? t('LW.settings.authorities.offline.disable_failed') });
        } else {
          setMessage({ severity: 'info', text: t('LW.settings.authorities.offline.disabled') });
        }
        await refresh();
      } finally {
        setBusy(false);
        setProgress(null);
      }
      return;
    }

    setBusy(true);
    try {
      const result = await bridge.setAuthorityLifecycleEnabled({
        enabled: true,
        profile: status?.profile,
      });
      if (!result.ok) {
        setMessage({ severity: 'error', text: result.error ?? t('LW.settings.authorities.offline.enable_failed') });
      } else {
        setMessage({
          severity: 'success',
          text: readyMessage,
        });
      }
      await refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleUpdate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await bridge.runAuthorityLifecycleUpdate();
      if (!result.ok) {
        setMessage({ severity: 'error', text: result.error ?? t('LW.settings.authorities.offline.update_failed') });
      } else {
        setMessage({ severity: 'success', text: t('LW.settings.authorities.offline.updated') });
      }
      await refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const working = busy || status?.busy;
  const disk = status?.diskUsage;
  const totalDisk = disk ? disk.rawBytes + disk.packBytes : 0;
  const authorityLabel = status?.label ?? t('LW.settings.authorities.offline.title');
  const setupDescription =
    status?.profile === 'japanese' || status?.profile === 'tibetan'
      ? t('LW.settings.authorities.offline.setup_description_simple')
      : t('LW.settings.authorities.offline.setup_description_full');
  const readyMessage =
    status?.profile === 'japanese'
      ? t('LW.settings.authorities.offline.ready_japanese')
      : status?.profile === 'tibetan'
        ? t('LW.settings.authorities.offline.ready_tibetan')
        : t('LW.settings.authorities.offline.ready_default');
  const wikidataPacks = status?.packs.filter((pack) => pack.id.startsWith('wikidata-')) ?? [];
  const installedWikidataPacks = wikidataPacks.filter((pack) => pack.installed).length;

  return (
    <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', px: 0, py: 1.5 }}>
      <Stack spacing={1.5} width="100%">
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="subtitle2">{authorityLabel}</Typography>
            <Typography variant="body2" color="text.secondary">
              {setupDescription}
            </Typography>
          </Box>
          <Switch
            checked={!!status?.enabled}
            disabled={working || !status?.entityDbReady}
            onChange={(_event, checked) => void handleEnableChange(checked)}
            inputProps={{ 'aria-label': t('LW.settings.authorities.offline.enable') }}
          />
        </Stack>

        {!status?.entityDbReady && (
          <Alert severity="warning">
            {t('LW.settings.authorities.offline.entity_db_required')}
          </Alert>
        )}

        {status?.entityDbReady && (
          <Stack spacing={0.75}>
            {status.rawSources.map((source) => (
              <Typography key={source.id} variant="body2" color="text.secondary">
                {source.label}:{' '}
                {source.installed
                  ? `installed (${source.version ?? 'unknown version'})`
                  : 'not installed'}
              </Typography>
            ))}
            {wikidataPacks.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Wikidata — compiled tagging packs: {installedWikidataPacks} of{' '}
                {wikidataPacks.length} ready
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              All compiled packs:{' '}
              {status.packsReady
                ? `${status.packs.filter((p) => p.installed).length} of ${status.packs.length} ready`
                : 'not ready'}
              {status.packBundleVersion ? ` · bundle ${status.packBundleVersion}` : ''}
              {totalDisk > 0 ? ` · ${formatBytes(totalDisk)} on disk` : ''}
            </Typography>
            {status.lastCheckAt && (
              <Typography variant="caption" color="text.secondary">
                Last check: {new Date(status.lastCheckAt).toLocaleString()}
              </Typography>
            )}
          </Stack>
        )}

        {status?.updateAvailable && status.enabled && (
          <Chip
            color="warning"
            label="Update available"
            size="small"
            sx={{ alignSelf: 'flex-start' }}
          />
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
            variant="outlined"
            disabled={working || !status?.enabled || !status?.entityDbReady}
            onClick={() => void handleUpdate()}
          >
            Update now
          </Button>
          <Button
            size="small"
            variant="text"
            disabled={!status?.entityDbFolder}
            onClick={() => void bridge.revealAuthorityLifecycleFolder()}
          >
            Open folder
          </Button>
          <Button size="small" variant="text" disabled={working} onClick={() => void refresh()}>
            Refresh
          </Button>
        </Stack>
      </Stack>
    </ListItem>
  );
};
