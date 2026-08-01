import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  refreshPluginRegistry,
  setPluginRegistrySnapshot,
  type PluginHostSnapshotView,
  type PluginRecordView,
} from '../../plugins';
import { clearPackContentCache } from '../../services/authority-pack-lookup';
import { refreshCbdbConcordanceAfterPackLifecycle } from '../../autoTagging/cbdbConcordance';
import type { IDialog } from '../type';
import type { PluginReleaseEntry } from '../../../../../apps/commons/src/desktop/pluginRegistryTypes';

function PluginRow({
  plugin,
  busy,
  onToggle,
  remote,
  onInstall,
}: {
  plugin: PluginRecordView;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  remote?: PluginReleaseEntry;
  onInstall?: () => void;
}) {
  const packs = plugin.manifest?.contributions?.authorityPacks ?? [];
  const producers = plugin.manifest?.contributions?.autoTagging ?? [];

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Stack spacing={0.75} flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={600}>
              {plugin.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              v{plugin.version}
            </Typography>
            {plugin.languages.map((lang) => (
              <Chip key={lang} size="small" label={lang} variant="outlined" />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {plugin.description}
          </Typography>
          {plugin.manifestError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {plugin.manifestError}
            </Alert>
          )}
          {!plugin.manifestError && (packs.length > 0 || producers.length > 0) && (
            <Typography variant="caption" color="text.secondary">
              {producers.length > 0 && `${producers.length} auto-tagging method(s)`}
              {producers.length > 0 && packs.length > 0 && ' · '}
              {packs.length > 0 && `${packs.length} authority pack(s)`}
            </Typography>
          )}
          {plugin.homepage && (
            <Link href={plugin.homepage} target="_blank" rel="noreferrer" variant="caption">
              Documentation
            </Link>
          )}
          {remote && remote.version !== plugin.version && onInstall && (
            <Button
              size="small"
              variant="outlined"
              onClick={onInstall}
              disabled={busy}
              sx={{ alignSelf: 'flex-start' }}
            >
              Update to v{remote.version}
            </Button>
          )}
        </Stack>
        <Switch
          checked={plugin.enabled}
          disabled={busy || !!plugin.manifestError}
          onChange={(e) => onToggle(e.target.checked)}
          inputProps={{ 'aria-label': `Enable ${plugin.name}` }}
        />
      </Stack>
    </Box>
  );
}

export const PluginsDialog = ({ onClose, open = false }: IDialog) => {
  const [snapshot, setSnapshot] = useState<PluginHostSnapshotView | null>(null);
  const [remotePlugins, setRemotePlugins] = useState<PluginReleaseEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const next = await refreshPluginRegistry();
    setSnapshot(next);
    try {
      const remote = await window.electronAPI?.pluginsGetRemoteIndex?.();
      setRemotePlugins(remote?.plugins ?? []);
    } catch {
      // The local plugin list remains usable while offline.
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const next = await window.electronAPI?.pluginsSetEnabled?.(pluginId, enabled);
      // Enabling a plugin can (re)copy its authority packs to disk — drop any
      // cached pack contents so the tag-bomb dialog picks up the new files.
      clearPackContentCache();
      if (enabled) {
        try {
          await refreshCbdbConcordanceAfterPackLifecycle();
        } catch {
          // Plugin enable succeeded; panel reload remains the safety net.
        }
      }
      if (next) {
        setSnapshot(next);
        setPluginRegistrySnapshot(next);
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    setBusy(true);
    setError(null);
    try {
      const folder = await window.electronAPI?.pluginsPickInstallFolder?.();
      if (!folder) return;
      const next = await window.electronAPI?.pluginsInstallFrom?.(folder);
      if (next) {
        setSnapshot(next);
        setPluginRegistrySnapshot(next);
        await refreshPluginRegistry();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoteInstall = async (entry: PluginReleaseEntry) => {
    setBusy(true);
    setError(null);
    try {
      const next = await window.electronAPI?.pluginsInstallRemote?.(entry);
      if (next) {
        setSnapshot(next);
        setPluginRegistrySnapshot(next);
        await refreshPluginRegistry();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" onClose={() => onClose?.('close')} open={open}>
      <DialogTitle>Plugins</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Optional tools for specific languages and periods. Enable a plugin to add its authority
            packs and auto-tagging methods to Le Jean-Baptiste.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {!snapshot?.plugins.length && (
            <Alert severity="info">
              No plugins installed yet. In development, plugins from the sibling{' '}
              <code>plugins/packages</code> folder are copied automatically on first launch.
            </Alert>
          )}
          {snapshot?.plugins.map((plugin) => (
            <PluginRow
              key={plugin.id}
              plugin={plugin}
              busy={busy}
              onToggle={(enabled) => void handleToggle(plugin.id, enabled)}
              remote={remotePlugins.find((entry) => entry.id === plugin.id)}
              onInstall={() => {
                const entry = remotePlugins.find((candidate) => candidate.id === plugin.id);
                if (entry) void handleRemoteInstall(entry);
              }}
            />
          ))}
          {remotePlugins
            .filter((entry) => !snapshot?.plugins.some((plugin) => plugin.id === entry.id))
            .map((entry) => (
              <Box key={entry.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {entry.name}{' '}
                      <Typography component="span" variant="caption">
                        v{entry.version}
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {entry.description}
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    onClick={() => void handleRemoteInstall(entry)}
                    disabled={busy}
                  >
                    Install
                  </Button>
                </Stack>
              </Box>
            ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => void handleInstall()} disabled={busy}>
          Install from folder…
        </Button>
        <Box flex={1} />
        <Button onClick={() => onClose?.('close')}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
