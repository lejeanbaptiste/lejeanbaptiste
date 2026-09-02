import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItem,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageToolSettings {
  enabled: boolean;
  baseUrl: string;
  verifiedAt: string | null;
  verifiedBaseUrl: string;
  checkMode: 'onDemand' | 'live';
  managedInstall: boolean;
  ngramsEnabled: boolean;
  installedVersion: string | null;
}

interface LanguageToolConnectionResult {
  error?: string;
  languageCount?: number;
  ok: boolean;
}

interface LanguageToolInstallStatus {
  installed: boolean;
  version: string | null;
  ngrams: { en: boolean };
  java: { ok: boolean; version?: string; error?: string; managed?: boolean };
  javaInstallOffered: boolean;
  managedJavaInstalled: boolean;
  server: 'stopped' | 'starting' | 'running' | 'failed';
  serverError?: string;
}

const DEFAULT_LANGUAGE_TOOL_SETTINGS: LanguageToolSettings = {
  enabled: false,
  baseUrl: 'http://localhost:8010',
  verifiedAt: null,
  verifiedBaseUrl: '',
  checkMode: 'onDemand',
  managedInstall: false,
  ngramsEnabled: false,
  installedVersion: null,
};

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        languageToolSettings: LanguageToolSettings | null;
        setLanguageToolSettings: (settings: Partial<LanguageToolSettings>) => void | Promise<void>;
        testLanguageToolConnection: (
          settings: Partial<LanguageToolSettings>,
        ) => Promise<LanguageToolConnectionResult>;
      };
    }
  ).__ljbCommonsUi;

export const DesktopLanguageTool = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [settings, setSettings] = useState<LanguageToolSettings>(
    bridge?.languageToolSettings ?? DEFAULT_LANGUAGE_TOOL_SETTINGS,
  );
  const [status, setStatus] = useState<{
    message: string;
    severity: 'error' | 'info' | 'success';
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<LanguageToolInstallStatus | null>(null);

  const refreshInstallStatus = useCallback(async () => {
    const status = await window.electronAPI?.languageToolGetInstallStatus?.();
    if (status) setInstallStatus(status);
  }, []);

  useEffect(() => {
    if (!bridge?.languageToolSettings) return;
    setSettings(bridge.languageToolSettings);
  }, [bridge?.languageToolSettings]);

  useEffect(() => {
    void refreshInstallStatus();
    const unsubscribe = window.electronAPI?.onLanguageToolInstallProgress?.((progress) => {
      if (progress.message) setProgressMessage(progress.message);
      else if (progress.phase === 'download' && progress.totalBytes && progress.receivedBytes) {
        const pct = Math.min(99, Math.round((100 * progress.receivedBytes) / progress.totalBytes));
        setProgressMessage(`Downloading… ${pct}%`);
      }
    });
    return () => unsubscribe?.();
  }, [refreshInstallStatus]);

  if (!bridge) return null;

  const persist = async (next: LanguageToolSettings) => {
    setSaving(true);
    try {
      await bridge.setLanguageToolSettings(next);
      setSettings(next);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <Key extends keyof LanguageToolSettings>(
    key: Key,
    value: LanguageToolSettings[Key],
  ) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setStatus(null);
    void persist(next);
  };

  const establishConnection = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const result = await bridge.testLanguageToolConnection(settings);
      if (!result.ok) {
        setStatus({
          severity: 'error',
          message: result.error ?? t('LW.settings.language_tool.connection_failed'),
        });
        return;
      }
      const verified: LanguageToolSettings = {
        ...settings,
        enabled: true,
        verifiedAt: new Date().toISOString(),
        verifiedBaseUrl: settings.managedInstall
          ? 'http://127.0.0.1:8010'
          : settings.baseUrl.trim().replace(/\/+$/, ''),
      };
      await persist(verified);
      setStatus({
        severity: 'success',
        message: t('LW.settings.language_tool.connected'),
      });
      await refreshInstallStatus();
    } catch (error) {
      setStatus({
        severity: 'error',
        message:
          error instanceof Error ? error.message : t('LW.settings.language_tool.connection_failed'),
      });
    } finally {
      setChecking(false);
    }
  };

  const runInstallJava = async () => {
    setBusy(true);
    setProgressMessage(t('LW.settings.language_tool.java_downloading'));
    setStatus(null);
    try {
      const next = await window.electronAPI?.languageToolInstallJava?.();
      if (next) setInstallStatus(next);
      await refreshInstallStatus();
      setStatus({ severity: 'success', message: t('LW.settings.language_tool.java_install_ok') });
    } catch (error) {
      setStatus({
        severity: 'error',
        message:
          error instanceof Error ? error.message : t('LW.settings.language_tool.java_install_failed'),
      });
    } finally {
      setBusy(false);
      setProgressMessage(null);
    }
  };

  const runInstall = async () => {
    setBusy(true);
    setProgressMessage(t('LW.settings.language_tool.installing'));
    setStatus(null);
    try {
      const next = await window.electronAPI?.languageToolInstall?.();
      if (next) setInstallStatus(next);
      await refreshInstallStatus();
      setStatus({ severity: 'success', message: t('LW.settings.language_tool.install_ok') });
      const refreshed = await window.electronAPI?.getLanguageToolSettings?.();
      if (refreshed) setSettings(refreshed);
    } catch (error) {
      setStatus({
        severity: 'error',
        message:
          error instanceof Error ? error.message : t('LW.settings.language_tool.install_failed'),
      });
    } finally {
      setBusy(false);
      setProgressMessage(null);
    }
  };

  const runRemove = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const next = await window.electronAPI?.languageToolRemove?.();
      if (next) setInstallStatus(next);
      const refreshed = await window.electronAPI?.getLanguageToolSettings?.();
      if (refreshed) setSettings(refreshed);
      setStatus({ severity: 'info', message: t('LW.settings.language_tool.removed') });
    } catch (error) {
      setStatus({
        severity: 'error',
        message:
          error instanceof Error ? error.message : t('LW.settings.language_tool.remove_failed'),
      });
    } finally {
      setBusy(false);
    }
  };

  const runNgrams = async () => {
    setBusy(true);
    setProgressMessage(t('LW.settings.language_tool.ngrams_downloading'));
    setStatus(null);
    try {
      const next = await window.electronAPI?.languageToolInstallNgrams?.();
      if (next) setInstallStatus(next);
      const refreshed = await window.electronAPI?.getLanguageToolSettings?.();
      if (refreshed) setSettings(refreshed);
      setStatus({ severity: 'success', message: t('LW.settings.language_tool.ngrams_ok') });
    } catch (error) {
      setStatus({
        severity: 'error',
        message:
          error instanceof Error ? error.message : t('LW.settings.language_tool.ngrams_failed'),
      });
    } finally {
      setBusy(false);
      setProgressMessage(null);
    }
  };

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', py: 0.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
          {t('LW.settings.language_tool.description')}
        </Typography>

        <Stack spacing={0.75}>
          <Alert severity={installStatus?.java.ok ? 'success' : 'warning'} sx={{ py: 0 }}>
            {installStatus?.java.ok
              ? t('LW.settings.language_tool.java_ok', {
                  version: installStatus.java.version ?? '17+',
                }) +
                (installStatus.java.managed
                  ? ` (${t('LW.settings.language_tool.java_managed')})`
                  : '')
              : (installStatus?.java.error ?? t('LW.settings.language_tool.java_missing'))}
          </Alert>

          {installStatus?.javaInstallOffered ? (
            <Stack direction="row" flexWrap="wrap" spacing={1}>
              <Button
                disabled={busy}
                onClick={() => void runInstallJava()}
                size="small"
                variant="contained"
              >
                {t('LW.settings.language_tool.java_download')}
              </Button>
              <Button disabled={busy} onClick={() => void refreshInstallStatus()} size="small" variant="outlined">
                {t('LW.settings.language_tool.java_refresh')}
              </Button>
            </Stack>
          ) : (
            <Button disabled={busy} onClick={() => void refreshInstallStatus()} size="small" variant="outlined">
              {t('LW.settings.language_tool.java_refresh')}
            </Button>
          )}

          <Typography variant="body2">
            {installStatus?.installed
              ? t('LW.settings.language_tool.installed_version', {
                  version: installStatus.version ?? '?',
                })
              : t('LW.settings.language_tool.not_installed')}
            {installStatus?.server && installStatus.installed
              ? ` · ${t(`LW.settings.language_tool.server_${installStatus.server}`)}`
              : ''}
          </Typography>

          <Stack direction="row" flexWrap="wrap" spacing={1}>
            <Button
              disabled={busy || !installStatus?.java.ok}
              onClick={() => void runInstall()}
              size="small"
              variant="contained"
            >
              {installStatus?.installed
                ? t('LW.settings.language_tool.reinstall')
                : t('LW.settings.language_tool.install')}
            </Button>
            <Button
              disabled={busy || !installStatus?.installed}
              onClick={() => void runRemove()}
              size="small"
              variant="outlined"
            >
              {t('LW.settings.language_tool.remove')}
            </Button>
            <Button
              disabled={busy || !installStatus?.installed || installStatus.ngrams.en}
              onClick={() => void runNgrams()}
              size="small"
              variant="outlined"
            >
              {installStatus?.ngrams.en
                ? t('LW.settings.language_tool.ngrams_installed')
                : t('LW.settings.language_tool.ngrams_download')}
            </Button>
          </Stack>

          <Typography color="text.secondary" variant="caption">
            {t('LW.settings.language_tool.ngrams_warning')}
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={settings.enabled}
                disabled={saving}
                onChange={(event) => updateSetting('enabled', event.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">{t('LW.settings.language_tool.enabled')}</Typography>
            }
            sx={{ ml: 0 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={settings.managedInstall}
                disabled={saving || !installStatus?.installed}
                onChange={(event) => updateSetting('managedInstall', event.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">{t('LW.settings.language_tool.use_managed')}</Typography>
            }
            sx={{ ml: 0 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={settings.ngramsEnabled}
                disabled={saving || !installStatus?.ngrams.en}
                onChange={(event) => updateSetting('ngramsEnabled', event.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">{t('LW.settings.language_tool.use_ngrams')}</Typography>
            }
            sx={{ ml: 0 }}
          />

          <FormControl fullWidth size="small">
            <InputLabel id="lt-check-mode-label">
              {t('LW.settings.language_tool.check_mode')}
            </InputLabel>
            <Select
              label={t('LW.settings.language_tool.check_mode')}
              labelId="lt-check-mode-label"
              onChange={(event) =>
                updateSetting('checkMode', event.target.value as 'onDemand' | 'live')
              }
              value={settings.checkMode}
            >
              <MenuItem value="onDemand">{t('LW.settings.language_tool.mode_ondemand')}</MenuItem>
              <MenuItem value="live">{t('LW.settings.language_tool.mode_live')}</MenuItem>
            </Select>
          </FormControl>

          {!settings.managedInstall ? (
            <TextField
              fullWidth
              helperText={t('LW.settings.language_tool.privacy_note')}
              label={t('LW.settings.language_tool.base_url')}
              onChange={(event) => {
                setSettings((current) => ({ ...current, baseUrl: event.target.value }));
                setStatus(null);
              }}
              onBlur={() => void persist(settings)}
              size="small"
              value={settings.baseUrl}
            />
          ) : null}

          <Collapse in={Boolean(status) || Boolean(progressMessage)}>
            {progressMessage ? (
              <Alert severity="info" sx={{ py: 0, mb: 0.5 }}>
                {progressMessage}
              </Alert>
            ) : null}
            {status ? (
              <Alert severity={status.severity} sx={{ py: 0 }}>
                {status.message}
              </Alert>
            ) : null}
          </Collapse>

          <Button
            disabled={checking || busy}
            onClick={() => void establishConnection()}
            size="small"
            variant="outlined"
          >
            {checking
              ? t('LW.settings.language_tool.checking')
              : t('LW.settings.language_tool.test_connection')}
          </Button>
        </Stack>
      </Box>
    </ListItem>
  );
};
