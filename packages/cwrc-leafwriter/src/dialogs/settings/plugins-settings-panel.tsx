import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Link,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  refreshPluginRegistry,
  setPluginRegistrySnapshot,
  type PluginHostSnapshotView,
  type PluginRecordView,
} from '../../plugins';
import { clearPackContentCache } from '../../services/authority-pack-lookup';
import { refreshCbdbConcordanceAfterPackLifecycle } from '../../autoTagging/cbdbConcordance';
import type { PluginReleaseEntry } from '../../../../../apps/commons/src/desktop/pluginRegistryTypes';
import { documentLanguageMatchesPlugin } from '../../../../../apps/commons/src/desktop/pluginLanguage';

const pluginSupportsLanguage = (
  plugin: Pick<PluginRecordView, 'id'> & { languages?: string[] },
  language: string | null,
): boolean => {
  if (!language || !plugin.languages || plugin.languages.length === 0) return true;
  // Same rule as the bootstrap auto-enable, so a plugin can never be enabled for a
  // project and then be missing from the list that turns it off.
  return documentLanguageMatchesPlugin(language, plugin.languages);
};

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
  const { t } = useTranslation();
  const packs = plugin.manifest?.contributions?.authorityPacks ?? [];
  const producers = plugin.manifest?.contributions?.autoTagging ?? [];
  const hasConfigSurface = false;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
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
          {plugin.manifestError && <Alert severity="error">{plugin.manifestError}</Alert>}
          {!plugin.manifestError && (packs.length > 0 || producers.length > 0) && (
            <Typography variant="caption" color="text.secondary">
              {producers.length > 0 &&
                t('LW.settings.plugins.auto_tagging_methods', { count: producers.length })}
              {producers.length > 0 && packs.length > 0 && ' · '}
              {packs.length > 0 &&
                t('LW.settings.plugins.authority_packs', { count: packs.length })}
            </Typography>
          )}
          {plugin.homepage && (
            <Link href={plugin.homepage} target="_blank" rel="noreferrer" variant="caption">
              {t('LW.settings.plugins.documentation')}
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
              {t('LW.settings.plugins.update_to_version', { version: remote.version })}
            </Button>
          )}
        </Stack>
        <Stack alignItems="center" spacing={1}>
          <Switch
            checked={plugin.enabled}
            disabled={busy || !!plugin.manifestError}
            onChange={(event) => onToggle(event.target.checked)}
            inputProps={{
              'aria-label': t('LW.settings.plugins.enable_plugin', { name: plugin.name }),
            }}
          />
          {hasConfigSurface && (
            <IconButton size="small" aria-label={t('LW.settings.plugins.plugin_settings')}>
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export const PluginsSettingsPanel = ({ active = true }: { active?: boolean }) => {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<PluginHostSnapshotView | null>(null);
  const [remotePlugins, setRemotePlugins] = useState<PluginReleaseEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectLanguage, setProjectLanguage] = useState<string | null>(null);
  const [tab, setTab] = useState<'installed' | 'available'>('installed');

  const load = useCallback(async () => {
    setError(null);
    const next = await refreshPluginRegistry();
    setSnapshot(next);
    try {
      const remote = await window.electronAPI?.pluginsGetRemoteIndex?.();
      setRemotePlugins(remote?.plugins ?? []);
    } catch {
      setRemotePlugins([]);
    }
    void window.__leafWriterProject
      ?.getProjectSourceLanguage?.()
      .then((language) => setProjectLanguage(language ?? null));
  }, []);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  const installedPlugins = useMemo(
    () =>
      snapshot?.plugins.filter((plugin) => pluginSupportsLanguage(plugin, projectLanguage)) ?? [],
    [projectLanguage, snapshot?.plugins],
  );

  const availablePlugins = useMemo(
    () =>
      remotePlugins.filter(
        (entry) =>
          !snapshot?.plugins.some((plugin) => plugin.id === entry.id) &&
          pluginSupportsLanguage(entry, projectLanguage),
      ),
    [remotePlugins, projectLanguage, snapshot?.plugins],
  );

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const next = await window.electronAPI?.pluginsSetEnabled?.(pluginId, enabled);
      clearPackContentCache();
      if (enabled) {
        try {
          await refreshCbdbConcordanceAfterPackLifecycle();
        } catch {
          // Panel refresh remains the fallback.
        }
      }
      if (next) setSnapshot(next);
      await refreshPluginRegistry();
      const refreshed = await window.electronAPI?.pluginsGetSnapshot?.();
      if (refreshed) setSnapshot(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleInstallFromFolder = async () => {
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
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('LW.settings.plugins.description')}
      </Typography>
      {projectLanguage && (
        <Typography variant="caption" color="text.secondary">
          {t('LW.settings.plugins.filtered_for_language', { language: projectLanguage })}
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        sx={{ minHeight: 0, '& .MuiTab-root': { minHeight: 34 } }}
      >
        <Tab
          value="installed"
          label={t('LW.settings.plugins.installed_tab', { count: installedPlugins.length })}
        />
        <Tab
          value="available"
          label={t('LW.settings.plugins.available_tab', { count: availablePlugins.length })}
        />
      </Tabs>
      {tab === 'installed' && (
        <Stack spacing={1.25}>
          {installedPlugins.length === 0 ? (
            <Alert severity="info">{t('LW.settings.plugins.none_installed')}</Alert>
          ) : (
            installedPlugins.map((plugin) => (
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
            ))
          )}
        </Stack>
      )}
      {tab === 'available' && (
        <Stack spacing={1.25}>
          <Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => void handleInstallFromFolder()}
              disabled={busy}
            >
              {t('LW.settings.plugins.install_from_folder')}
            </Button>
          </Box>
          {availablePlugins.length === 0 ? (
            <Alert severity="info">{t('LW.settings.plugins.none_available')}</Alert>
          ) : (
            availablePlugins.map((entry) => (
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
                    {t('LW.settings.plugins.install')}
                  </Button>
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      )}
    </Stack>
  );
};
