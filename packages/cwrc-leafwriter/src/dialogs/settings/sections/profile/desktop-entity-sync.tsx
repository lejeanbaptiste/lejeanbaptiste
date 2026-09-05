import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  FormControlLabel,
  ListItem,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type SyncAuthMode = 'github' | 'oidc' | 'bearer';

interface SyncAuth {
  mode: SyncAuthMode;
  issuer?: string;
  clientId?: string;
}

interface SyncConfig {
  enabled: boolean;
  endpoint: string;
  intervalMinutes: number;
  auth: SyncAuth;
}

type SyncConfigPatch = Partial<Omit<SyncConfig, 'auth'>> & {
  auth?: Partial<SyncAuth>;
  bearerToken?: string;
};

interface SyncRunSummary {
  ok: boolean;
  reason: string;
  skipped?: string;
  stoppedEarly?: string;
  error?: string;
  pulledApplied?: number;
  pulledConflicts?: number;
  pushedApplied?: number;
  pushedReconciled?: number;
  pushedConflicts?: number;
  openConflicts?: number;
  cursor?: number;
  at?: string;
}

interface SyncStatus {
  config: SyncConfig;
  signedIn: boolean;
  hasLocalDatabase: boolean;
  cursor: number | null;
  openConflicts: number | null;
  lastRun: SyncRunSummary | null;
}

interface SyncConflict {
  id: number;
  projectEntityId: string;
  reason: string;
  projectRevision: number;
  centralRevision: number;
  projectSnapshot: string;
  centralSnapshot: string;
}

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        entitySyncStatus: SyncStatus | null;
        setEntitySyncConfig: (patch: SyncConfigPatch) => Promise<SyncConfig | null>;
        runEntitySyncNow: () => Promise<SyncRunSummary>;
        listEntitySyncConflicts: () => Promise<SyncConflict[]>;
        resolveEntitySyncConflict: (request: {
          id: number;
          keep: 'local' | 'remote';
        }) => Promise<{ ok: boolean }>;
      };
    }
  ).__ljbCommonsUi;

const formatWhen = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const syncSkippedKey = (reason?: string): string => {
  switch (reason) {
    case 'no-database':
      return 'LW.desktop.settings.entity_sync.skipped_no_database';
    case 'disabled':
      return 'LW.desktop.settings.entity_sync.skipped_disabled';
    case 'in-progress':
      return 'LW.desktop.settings.entity_sync.skipped_in_progress';
    case 'not-signed-in':
      return 'LW.desktop.settings.entity_sync.skipped_not_signed_in';
    case 'write-quota':
      return 'LW.desktop.settings.entity_sync.skipped_write_quota';
    default:
      return 'LW.desktop.settings.entity_sync.sync_skipped';
  }
};

type Feedback = { severity: 'error' | 'info' | 'success'; message: string } | null;

/**
 * Cross-device entity sync — endpoint + toggle, a Sync-now button, and an
 * inline conflict-resolution list. Setup guide:
 * docs/entity-sync-planning.md.
 */
export const DesktopEntitySync = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const status = bridge?.entitySyncStatus ?? null;

  const [endpoint, setEndpoint] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [enabled, setEnabled] = useState(false);
  const [authMode, setAuthMode] = useState<SyncAuthMode>('github');
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [bearerInput, setBearerInput] = useState('');

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState<'save' | 'sync' | 'resolve' | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[] | null>(null);
  const [expandedConflict, setExpandedConflict] = useState<number | null>(null);

  const configKey = status
    ? [
        status.config.endpoint,
        status.config.intervalMinutes,
        status.config.enabled,
        status.config.auth.mode,
        status.config.auth.issuer ?? '',
        status.config.auth.clientId ?? '',
      ].join('|')
    : '';
  useEffect(() => {
    if (!status) return;
    setEndpoint(status.config.endpoint);
    setIntervalMinutes(status.config.intervalMinutes || 5);
    setEnabled(status.config.enabled);
    setAuthMode(status.config.auth.mode);
    setIssuer(status.config.auth.issuer ?? '');
    setClientId(status.config.auth.clientId ?? '');
    setBearerInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const patch = useMemo<SyncConfigPatch>(
    () => ({
      enabled,
      endpoint: endpoint.trim(),
      intervalMinutes,
      auth: { mode: authMode, issuer: issuer.trim(), clientId: clientId.trim() },
      ...(bearerInput ? { bearerToken: bearerInput } : {}),
    }),
    [enabled, endpoint, intervalMinutes, authMode, issuer, clientId, bearerInput],
  );

  if (!bridge || !status) return null;

  const { lastRun } = status;
  const canSync = status.signedIn && enabled && Boolean(patch.endpoint);

  const handleSave = async () => {
    setBusy('save');
    setFeedback(null);
    try {
      await bridge.setEntitySyncConfig(patch);
      setFeedback({ severity: 'success', message: t('LW.desktop.settings.entity_sync.saved') });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSyncNow = async () => {
    setBusy('sync');
    setFeedback(null);
    try {
      const result = await bridge.runEntitySyncNow();
      if (result.ok) {
        setFeedback({
          severity: 'success',
          message: t('LW.desktop.settings.entity_sync.sync_ok', {
            pulled: result.pulledApplied ?? 0,
            pushed: result.pushedApplied ?? 0,
            conflicts: result.openConflicts ?? 0,
          }),
        });
      } else if (result.stoppedEarly === 'write-quota') {
        setFeedback({
          severity: 'info',
          message: t('LW.desktop.settings.entity_sync.skipped_write_quota', {
            pushed: result.pushedApplied ?? 0,
          }),
        });
      } else {
        const skipKey = syncSkippedKey(result.skipped);
        setFeedback({
          severity: result.skipped ? 'info' : 'error',
          message:
            result.error ??
            (result.skipped
              ? t(skipKey, { reason: result.skipped, defaultValue: result.skipped })
              : t('LW.desktop.settings.entity_sync.sync_skipped', { reason: 'unknown' })),
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const loadConflicts = async () => {
    const next = !showConflicts;
    setShowConflicts(next);
    if (next) setConflicts(await bridge.listEntitySyncConflicts());
  };

  const resolve = async (id: number, keep: 'local' | 'remote') => {
    setBusy('resolve');
    try {
      await bridge.resolveEntitySyncConflict({ id, keep });
      setConflicts(await bridge.listEntitySyncConflicts());
      setExpandedConflict(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ListItem
      dense
      disableGutters
      sx={{ alignItems: 'flex-start', flexDirection: 'column', py: 0.5 }}
    >
      <Typography color="text.secondary" sx={{ mb: 0.75 }} variant="caption">
        {t('LW.desktop.settings.entity_sync.description')}
      </Typography>

      {!status.signedIn && (
        <Alert severity="warning" sx={{ mb: 1, width: '100%' }}>
          {t(
            authMode === 'bearer'
              ? 'LW.desktop.settings.entity_sync.sign_in_bearer'
              : authMode === 'oidc'
                ? 'LW.desktop.settings.entity_sync.sign_in_oidc'
                : 'LW.desktop.settings.entity_sync.sign_in_required',
          )}
        </Alert>
      )}

      {!status.hasLocalDatabase && (
        <Alert severity="warning" sx={{ mb: 1, width: '100%' }}>
          {t('LW.desktop.settings.entity_sync.no_local_database')}
        </Alert>
      )}

      {typeof status.openConflicts === 'number' && status.openConflicts > 0 && (
        <Alert severity="error" sx={{ mb: 1, width: '100%' }}>
          {t('LW.desktop.settings.entity_sync.conflicts_pending', {
            count: status.openConflicts,
          })}
        </Alert>
      )}

      <Stack spacing={1} sx={{ width: '100%' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2">{t('LW.desktop.settings.entity_sync.enable')}</Typography>
          }
          sx={{ ml: 0 }}
        />

        <TextField
          fullWidth
          label={t('LW.desktop.settings.entity_sync.endpoint')}
          onChange={(event) => setEndpoint(event.target.value)}
          placeholder="https://grognard-entity-sync.<subdomain>.workers.dev"
          size="small"
          value={endpoint}
        />
        <TextField
          inputProps={{ min: 1, max: 1440, step: 1 }}
          label={t('LW.desktop.settings.entity_sync.interval')}
          onChange={(event) => {
            const next = Number(event.target.value);
            setIntervalMinutes(Number.isFinite(next) ? next : 5);
          }}
          size="small"
          sx={{ width: 160 }}
          type="number"
          value={intervalMinutes}
        />

        <TextField
          fullWidth
          label={t('LW.desktop.settings.entity_sync.auth_mode')}
          onChange={(event) => setAuthMode(event.target.value as SyncAuthMode)}
          select
          size="small"
          value={authMode}
        >
          <MenuItem value="github">{t('LW.desktop.settings.entity_sync.auth_github')}</MenuItem>
          <MenuItem value="bearer">{t('LW.desktop.settings.entity_sync.auth_bearer')}</MenuItem>
          <MenuItem value="oidc">{t('LW.desktop.settings.entity_sync.auth_oidc')}</MenuItem>
        </TextField>

        {authMode === 'bearer' && (
          <TextField
            fullWidth
            label={t('LW.desktop.settings.entity_sync.bearer_token')}
            onChange={(event) => setBearerInput(event.target.value)}
            placeholder={
              status.signedIn ? t('LW.desktop.settings.entity_sync.bearer_saved') : undefined
            }
            size="small"
            type="password"
            value={bearerInput}
          />
        )}

        {authMode === 'oidc' && (
          <>
            <Alert severity="info" sx={{ py: 0 }}>
              {t('LW.desktop.settings.entity_sync.oidc_todo')}
            </Alert>
            <TextField
              fullWidth
              label={t('LW.desktop.settings.entity_sync.oidc_issuer')}
              onChange={(event) => setIssuer(event.target.value)}
              placeholder="https://auth.huma-num.fr/realms/…"
              size="small"
              value={issuer}
            />
            <TextField
              fullWidth
              label={t('LW.desktop.settings.entity_sync.oidc_client_id')}
              onChange={(event) => setClientId(event.target.value)}
              size="small"
              value={clientId}
            />
          </>
        )}

        <Collapse in={Boolean(feedback)}>
          {feedback ? (
            <Alert severity={feedback.severity} sx={{ py: 0, whiteSpace: 'pre-wrap' }}>
              {feedback.message}
            </Alert>
          ) : (
            <span />
          )}
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            disabled={busy !== null}
            onClick={() => void handleSave()}
            size="small"
            variant="contained"
          >
            {busy === 'save'
              ? t('LW.desktop.settings.entity_sync.saving')
              : t('LW.desktop.settings.entity_sync.save')}
          </Button>
          <Button
            disabled={busy !== null || !canSync}
            onClick={() => void handleSyncNow()}
            size="small"
            variant="outlined"
          >
            {busy === 'sync'
              ? t('LW.desktop.settings.entity_sync.syncing')
              : t('LW.desktop.settings.entity_sync.sync_now')}
          </Button>
          {typeof status.openConflicts === 'number' && status.openConflicts > 0 && (
            <Button onClick={() => void loadConflicts()} size="small" variant="text">
              {showConflicts
                ? t('LW.desktop.settings.entity_sync.conflicts_hide')
                : t('LW.desktop.settings.entity_sync.conflicts_review', {
                    count: status.openConflicts,
                  })}
            </Button>
          )}
        </Box>

        <Typography color="text.secondary" component="p" variant="caption">
          {status.cursor === null
            ? t('LW.desktop.settings.entity_sync.never_synced')
            : t('LW.desktop.settings.entity_sync.synced_through', { cursor: status.cursor })}
          {lastRun?.at
            ? ` · ${
                lastRun.ok
                  ? t('LW.desktop.settings.entity_sync.last_ok', {
                      when: formatWhen(lastRun.at),
                      pulled: lastRun.pulledApplied ?? 0,
                      pushed: lastRun.pushedApplied ?? 0,
                    })
                  : t('LW.desktop.settings.entity_sync.last_failed', {
                      when: formatWhen(lastRun.at),
                      detail: lastRun.error ?? lastRun.skipped ?? 'error',
                    })
              }`
            : ''}
        </Typography>

        <Collapse in={showConflicts}>
          <Stack spacing={1} sx={{ pt: 1 }}>
            {conflicts === null ? (
              <Typography variant="caption">
                {t('LW.desktop.settings.entity_sync.loading_conflicts')}
              </Typography>
            ) : conflicts.length === 0 ? (
              <Typography variant="caption">
                {t('LW.desktop.settings.entity_sync.no_conflicts')}
              </Typography>
            ) : (
              conflicts.map((conflict) => (
                <Box
                  key={conflict.id}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}
                >
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {conflict.projectEntityId}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {t('LW.desktop.settings.entity_sync.conflict_meta', {
                      reason: conflict.reason,
                      local: conflict.projectRevision,
                      server: conflict.centralRevision,
                    })}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Button
                      color="primary"
                      disabled={busy !== null}
                      onClick={() => void resolve(conflict.id, 'local')}
                      size="small"
                      variant="outlined"
                    >
                      {t('LW.desktop.settings.entity_sync.keep_mine')}
                    </Button>
                    <Button
                      color="primary"
                      disabled={busy !== null}
                      onClick={() => void resolve(conflict.id, 'remote')}
                      size="small"
                      variant="outlined"
                    >
                      {t('LW.desktop.settings.entity_sync.keep_theirs')}
                    </Button>
                    <Button
                      onClick={() =>
                        setExpandedConflict((current) =>
                          current === conflict.id ? null : conflict.id,
                        )
                      }
                      size="small"
                      variant="text"
                    >
                      {expandedConflict === conflict.id
                        ? t('LW.desktop.settings.entity_sync.hide_versions')
                        : t('LW.desktop.settings.entity_sync.show_versions')}
                    </Button>
                  </Box>
                  <Collapse in={expandedConflict === conflict.id}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      {t('LW.desktop.settings.entity_sync.mine')}
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        p: 1,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        fontSize: '0.7rem',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {conflict.projectSnapshot || '(deleted)'}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('LW.desktop.settings.entity_sync.theirs')}
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        p: 1,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        fontSize: '0.7rem',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {conflict.centralSnapshot || '(deleted)'}
                    </Box>
                  </Collapse>
                </Box>
              ))
            )}
          </Stack>
        </Collapse>
      </Stack>
    </ListItem>
  );
};
