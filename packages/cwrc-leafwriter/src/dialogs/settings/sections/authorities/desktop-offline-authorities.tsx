import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  LinearProgress,
  ListItem,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type AuthorityLifecycleProfile = 'chinese' | 'japanese' | 'tibetan';

interface AuthorityLifecycleProgress {
  phase: 'compiling' | 'downloading' | 'extracting' | 'idle';
  message: string;
}

interface AuthorityLifecycleProfileStatus {
  id: AuthorityLifecycleProfile;
  label: string;
  enabled: boolean;
  installedPacks: number;
  totalPacks: number;
  packsReady: boolean;
}

interface AuthorityLifecycleAttribution {
  source: string;
  label: string;
  text: string;
}

interface AuthorityLifecycleStatus {
  busy: boolean;
  enabled: boolean;
  profile: AuthorityLifecycleProfile;
  profileStatuses?: AuthorityLifecycleProfileStatus[];
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
  referenceDataEnabled?: boolean;
  diskUsage: { packBytes: number; rawBytes: number } | null;
  attributions?: AuthorityLifecycleAttribution[];
}

interface AuthorityLifecycleRunResult {
  ok: boolean;
  error?: string;
}

interface CommonsUiBridge {
  authorityLifecycleStatus: AuthorityLifecycleStatus | null;
  refreshAuthorityLifecycle: () => Promise<void>;
  setAuthorityLifecycleEnabled: (options: {
    enabled: boolean;
    profile?: AuthorityLifecycleProfile;
    deleteFiles?: boolean;
  }) => Promise<AuthorityLifecycleRunResult>;
  setAuthorityLifecycleReferenceDataEnabled: (
    enabled: boolean,
  ) => Promise<AuthorityLifecycleRunResult>;
  runAuthorityLifecycleUpdate: () => Promise<AuthorityLifecycleRunResult>;
  revealAuthorityLifecycleFolder: () => Promise<void>;
}

const PROFILE_NAMES: Record<AuthorityLifecycleProfile, string> = {
  chinese: 'Chinese',
  japanese: 'Japanese',
  tibetan: 'Tibetan',
};

const PROFILE_SOURCES: Record<AuthorityLifecycleProfile, string> = {
  chinese: 'CBDB · DILA · Norbert · CHGIS · Wikidata',
  japanese: 'NDL · Wikidata',
  tibetan: 'Wikidata',
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
    window.addEventListener('grognardCommonsUiChanged', sync);
    return () => window.removeEventListener('grognardCommonsUiChanged', sync);
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

  const profileStatuses: AuthorityLifecycleProfileStatus[] =
    status?.profileStatuses ??
    (['chinese', 'japanese', 'tibetan'] as const).map((id) => ({
      id,
      label: PROFILE_NAMES[id],
      enabled: !!status?.enabled && status.profile === id,
      installedPacks: 0,
      totalPacks: 0,
      packsReady: false,
    }));

  const enabledCount = profileStatuses.filter((profile) => profile.enabled).length;

  const handleToggleProfile = async (profile: AuthorityLifecycleProfile, enabled: boolean) => {
    setMessage(null);

    if (!enabled) {
      const isLastEnabled = enabledCount === 1;
      let deleteFiles = false;

      if (isLastEnabled) {
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
        deleteFiles = response.response === 1;
      }

      setBusy(true);
      try {
        const result = await bridge.setAuthorityLifecycleEnabled({
          enabled: false,
          profile,
          deleteFiles,
        });
        if (!result.ok) {
          setMessage({
            severity: 'error',
            text: result.error ?? t('LW.settings.authorities.offline.disable_failed'),
          });
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
      const result = await bridge.setAuthorityLifecycleEnabled({ enabled: true, profile });
      if (!result.ok) {
        setMessage({
          severity: 'error',
          text: result.error ?? t('LW.settings.authorities.offline.enable_failed'),
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
        setMessage({
          severity: 'error',
          text: result.error ?? t('LW.settings.authorities.offline.update_failed'),
        });
      } else {
        setMessage({ severity: 'success', text: t('LW.settings.authorities.offline.updated') });
      }
      await refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleReferenceDataToggle = async (checked: boolean) => {
    if (!bridge) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await bridge.setAuthorityLifecycleReferenceDataEnabled(checked);
      if (!result.ok) {
        setMessage({
          severity: 'error',
          text: result.error ?? 'Could not change reference database setting.',
        });
      } else if (checked) {
        setMessage({
          severity: 'success',
          text: 'Reference databases installed (CBDB, Norbert, DILA).',
        });
      } else {
        setMessage({
          severity: 'info',
          text: 'Reference databases will no longer update. Existing files were kept.',
        });
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
  const chineseEnabled =
    status?.profileStatuses?.some((profile) => profile.id === 'chinese' && profile.enabled) ??
    false;

  const profileCaption = (profile: AuthorityLifecycleProfileStatus): string => {
    const sources = PROFILE_SOURCES[profile.id];
    if (!profile.enabled) return sources;
    if (profile.packsReady) return `${sources} — ready`;
    if (profile.totalPacks > 0) {
      return `${sources} — ${profile.installedPacks}/${profile.totalPacks} packs`;
    }
    return `${sources} — not downloaded`;
  };

  return (
    <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', px: 0, py: 1 }}>
      <Stack spacing={1} width="100%">
        <Box>
          <Typography variant="subtitle2">{t('LW.settings.authorities.offline.title')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {[
              status?.updateAvailable && enabledCount > 0 ? 'Update available' : null,
              status?.packBundleVersion ? `bundle ${status.packBundleVersion}` : null,
              totalDisk > 0 ? `${formatBytes(totalDisk)} on disk` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Offline entity lookup and tagging, per language.'}
          </Typography>
        </Box>

        {!status?.entityDbReady && (
          <Alert severity="warning" sx={{ py: 0 }}>
            {t('LW.settings.authorities.offline.entity_db_required')}
          </Alert>
        )}

        {profileStatuses.map((profile) => (
          <Stack
            key={profile.id}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">{PROFILE_NAMES[profile.id]}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {profileCaption(profile)}
              </Typography>
            </Box>
            <Switch
              size="small"
              checked={profile.enabled}
              disabled={working || !status?.entityDbReady}
              onChange={(_event, checked) => void handleToggleProfile(profile.id, checked)}
              inputProps={{ 'aria-label': `${PROFILE_NAMES[profile.id]} authority pack` }}
            />
          </Stack>
        ))}

        {chineseEnabled && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ pl: 0.5 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">Reference databases</Typography>
              <Typography variant="caption" color="text.secondary">
                Extra ~250&nbsp;MB (CBDB + Norbert sqlite, DILA TEI) for richer backfill —
                family/given names, titles, appointments
              </Typography>
            </Box>
            <Switch
              size="small"
              checked={Boolean(status?.referenceDataEnabled)}
              disabled={working || !status?.entityDbReady}
              onChange={(_event, checked) => void handleReferenceDataToggle(checked)}
              inputProps={{ 'aria-label': 'Reference databases for enrichment' }}
            />
          </Stack>
        )}

        {enabledCount > 0 && (status?.attributions?.length ?? 0) > 0 && (
          <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon fontSize="small" />}
              sx={{ minHeight: 0, px: 0 }}
            >
              <Typography variant="caption" color="text.secondary">
                Attributions
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <Stack spacing={0.5}>
                {status!.attributions!.map((attribution) => (
                  <Typography key={attribution.source} variant="caption" color="text.secondary">
                    {attribution.text}
                  </Typography>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {progress && working && (
          <Box>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {progress.message}
            </Typography>
          </Box>
        )}

        {message && (
          <Alert severity={message.severity} sx={{ py: 0 }}>
            {message.text}
          </Alert>
        )}

        {status?.lastError && !message && (
          <Alert severity="error" sx={{ py: 0 }}>
            {status.lastError}
          </Alert>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            disabled={working || enabledCount === 0 || !status?.entityDbReady}
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
