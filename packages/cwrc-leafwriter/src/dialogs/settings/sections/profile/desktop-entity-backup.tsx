import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  ListItem,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BackupConfigView {
  enabled: boolean;
  endpoint: string;
  accessKeyId: string;
  bucket: string;
  prefix: string;
  intervalMinutes: number;
  hasSecret: boolean;
  encryptionAvailable: boolean;
  credentialsLocked: boolean;
}

interface BackupStatus {
  config: BackupConfigView;
  hasLocalDatabase: boolean;
  lastBackup: {
    at: string;
    reason: string;
    uploadedBytes: number;
    sourceBytes: number;
  } | null;
  integrity: { ok: boolean; problems: string[]; checked: boolean };
}

interface BackupPatch {
  enabled?: boolean;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  prefix?: string;
  intervalMinutes?: number;
}

interface CloudSnapshot {
  key: string;
  size: number;
  timestamp: string;
  reason: string;
}

interface ProbeResult {
  ok: boolean;
  error?: string;
  objectCount?: number;
}

interface BackupResult {
  ok: boolean;
  key?: string;
  uploadedBytes?: number;
  skipped?: string;
  error?: string;
}

interface RestoreResult {
  ok: boolean;
  previousCopyDir: string;
  achievementsRestored?: boolean;
  error?: string;
}

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        entityDbBackupStatus: BackupStatus | null;
        refreshEntityDbBackupStatus: () => Promise<void>;
        setEntityDbBackupConfig: (patch: BackupPatch) => Promise<BackupConfigView | null>;
        clearEntityDbBackupConfig: () => Promise<void>;
        testEntityDbBackupConnection: (patch: BackupPatch) => Promise<ProbeResult>;
        runEntityDbBackupNow: () => Promise<BackupResult>;
        listEntityDbBackupSnapshots: () => Promise<CloudSnapshot[]>;
        restoreEntityDbBackup: (key: string) => Promise<RestoreResult>;
      };
    }
  ).__ljbCommonsUi;

const formatMB = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const backupSkippedKey = (reason?: string): string => {
  switch (reason) {
    case 'no-database':
      return 'LW.desktop.settings.entity_backup.skipped_no_database';
    case 'disabled':
      return 'LW.desktop.settings.entity_backup.skipped_disabled';
    case 'not-configured':
      return 'LW.desktop.settings.entity_backup.skipped_not_configured';
    case 'in-progress':
      return 'LW.desktop.settings.entity_backup.skipped_in_progress';
    default:
      return 'LW.desktop.settings.entity_backup.backup_skipped';
  }
};

type Feedback = { severity: 'error' | 'info' | 'success'; message: string } | null;

/**
 * Entity database → cloud backup. Snapshots the whole SQLite database to a
 * Cloudflare R2 bucket on a timer and on quit; restore pulls one back.
 * Full setup guide: docs/entity-db-cloud-backup-setup.md.
 */
export const DesktopEntityBackup = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const status = bridge?.entityDbBackupStatus ?? null;

  const [endpoint, setEndpoint] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [bucket, setBucket] = useState('');
  const [prefix, setPrefix] = useState('entity-db-backups/');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [enabled, setEnabled] = useState(false);

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState<'test' | 'save' | 'backup' | 'restore' | 'unlock' | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [snapshots, setSnapshots] = useState<CloudSnapshot[] | null>(null);
  const [restoreKey, setRestoreKey] = useState('');
  const [restoreArmed, setRestoreArmed] = useState(false);

  // Re-seed the form whenever the stored config changes underneath us.
  const configKey = status
    ? [
        status.config.endpoint,
        status.config.accessKeyId,
        status.config.bucket,
        status.config.prefix,
        status.config.intervalMinutes,
        status.config.enabled,
      ].join('|')
    : '';
  useEffect(() => {
    if (!status) return;
    setEndpoint(status.config.endpoint);
    setAccessKeyId(status.config.accessKeyId);
    setBucket(status.config.bucket);
    setPrefix(status.config.prefix || 'entity-db-backups/');
    setIntervalMinutes(status.config.intervalMinutes || 15);
    setEnabled(status.config.enabled);
    setSecretInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const patch = useMemo<BackupPatch>(
    () => ({
      enabled,
      endpoint: endpoint.trim(),
      accessKeyId: accessKeyId.trim(),
      bucket: bucket.trim(),
      prefix: prefix.trim() || 'entity-db-backups/',
      intervalMinutes,
      ...(secretInput ? { secretAccessKey: secretInput } : {}),
    }),
    [enabled, endpoint, accessKeyId, bucket, prefix, intervalMinutes, secretInput],
  );

  if (!bridge || !status) return null;

  const { encryptionAvailable, hasSecret, credentialsLocked } = status.config;
  const secretKnown = hasSecret || secretInput.trim().length > 0;
  const coreFilled =
    patch.endpoint && patch.accessKeyId && patch.bucket && secretKnown && encryptionAvailable;

  // Re-reading the status re-runs the decrypt, which is what re-triggers the
  // OS keychain prompt — so this doubles as "ask me again".
  const handleUnlockRetry = async () => {
    setBusy('unlock');
    setFeedback(null);
    try {
      await bridge.refreshEntityDbBackupStatus();
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy('test');
    setFeedback(null);
    try {
      const result = await bridge.testEntityDbBackupConnection(patch);
      setFeedback(
        result.ok
          ? {
              severity: 'success',
              message: t('LW.desktop.settings.entity_backup.test_ok', {
                count: result.objectCount ?? 0,
              }),
            }
          : {
              severity: 'error',
              message: result.error ?? t('LW.desktop.settings.entity_backup.test_failed'),
            },
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    setBusy('save');
    setFeedback(null);
    try {
      await bridge.setEntityDbBackupConfig(patch);
      setSecretInput('');
      setFeedback({ severity: 'success', message: t('LW.desktop.settings.entity_backup.saved') });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleBackupNow = async () => {
    setBusy('backup');
    setFeedback(null);
    try {
      const result = await bridge.runEntityDbBackupNow();
      if (result.ok) {
        setFeedback({
          severity: 'success',
          message: t('LW.desktop.settings.entity_backup.backup_ok', {
            size: result.uploadedBytes ? formatMB(result.uploadedBytes) : '—',
          }),
        });
      } else {
        const skipKey = backupSkippedKey(result.skipped);
        setFeedback({
          severity: result.skipped ? 'info' : 'error',
          message:
            result.error ??
            (result.skipped
              ? t(skipKey, { reason: result.skipped, defaultValue: result.skipped })
              : t('LW.desktop.settings.entity_backup.backup_skipped', { reason: 'unknown' })),
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleToggleRestore = async () => {
    const next = !showRestore;
    setShowRestore(next);
    setRestoreArmed(false);
    if (next && snapshots === null) {
      try {
        const list = await bridge.listEntityDbBackupSnapshots();
        setSnapshots(list);
        if (list[0]) setRestoreKey(list[0].key);
      } catch (error) {
        setFeedback({
          severity: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const handleRestore = async () => {
    if (!restoreKey) return;
    setBusy('restore');
    setFeedback(null);
    try {
      const result = await bridge.restoreEntityDbBackup(restoreKey);
      setFeedback(
        result.ok
          ? {
              severity: 'success',
              message: t(
                result.achievementsRestored
                  ? 'LW.desktop.settings.entity_backup.restore_ok_with_achievements'
                  : 'LW.desktop.settings.entity_backup.restore_ok',
                { dir: result.previousCopyDir },
              ),
            }
          : {
              severity: 'error',
              message: result.error ?? t('LW.desktop.settings.entity_backup.restore_failed'),
            },
      );
    } finally {
      setBusy(null);
      setRestoreArmed(false);
    }
  };

  return (
    <ListItem
      dense
      disableGutters
      sx={{ alignItems: 'flex-start', flexDirection: 'column', py: 0.5 }}
    >
      <Typography color="text.secondary" sx={{ mb: 0.75 }} variant="caption">
        {t('LW.desktop.settings.entity_backup.description')}
      </Typography>

      {status.integrity.checked && !status.integrity.ok && (
        <Alert severity="error" sx={{ mb: 1, width: '100%' }}>
          {t('LW.desktop.settings.entity_backup.integrity_bad')}
          {status.integrity.problems[0] ? ` (${status.integrity.problems[0]})` : ''}
        </Alert>
      )}

      {!encryptionAvailable && (
        <Alert severity="warning" sx={{ mb: 1, width: '100%' }}>
          {t('LW.desktop.settings.entity_backup.no_encryption')}
        </Alert>
      )}

      {credentialsLocked && (
        <Alert
          action={
            <Button
              color="inherit"
              disabled={busy === 'unlock'}
              onClick={handleUnlockRetry}
              size="small"
            >
              {t('LW.desktop.settings.entity_backup.credentials_locked_retry')}
            </Button>
          }
          severity="error"
          sx={{ mb: 1, width: '100%' }}
        >
          {t('LW.desktop.settings.entity_backup.credentials_locked')}
        </Alert>
      )}

      {!status.hasLocalDatabase && (
        <Alert severity="warning" sx={{ mb: 1, width: '100%' }}>
          {t('LW.desktop.settings.entity_backup.no_local_database')}
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
            <Typography variant="body2">{t('LW.desktop.settings.entity_backup.enable')}</Typography>
          }
          sx={{ ml: 0 }}
        />

        <TextField
          fullWidth
          label={t('LW.desktop.settings.entity_backup.endpoint')}
          onChange={(event) => setEndpoint(event.target.value)}
          placeholder="https://<account-id>.r2.cloudflarestorage.com"
          size="small"
          value={endpoint}
        />
        <TextField
          fullWidth
          label={t('LW.desktop.settings.entity_backup.bucket')}
          onChange={(event) => setBucket(event.target.value)}
          size="small"
          value={bucket}
        />
        <TextField
          fullWidth
          label={t('LW.desktop.settings.entity_backup.access_key_id')}
          onChange={(event) => setAccessKeyId(event.target.value)}
          size="small"
          value={accessKeyId}
        />
        <TextField
          fullWidth
          label={t('LW.desktop.settings.entity_backup.secret_access_key')}
          onChange={(event) => setSecretInput(event.target.value)}
          placeholder={hasSecret ? t('LW.desktop.settings.entity_backup.secret_saved') : undefined}
          size="small"
          type="password"
          value={secretInput}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            label={t('LW.desktop.settings.entity_backup.prefix')}
            onChange={(event) => setPrefix(event.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 160 }}
            value={prefix}
          />
          <TextField
            inputProps={{ min: 5, max: 1440, step: 5 }}
            label={t('LW.desktop.settings.entity_backup.interval')}
            onChange={(event) => {
              const next = Number(event.target.value);
              setIntervalMinutes(Number.isFinite(next) ? next : 15);
            }}
            size="small"
            sx={{ width: 140 }}
            type="number"
            value={intervalMinutes}
          />
        </Box>

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
            disabled={busy !== null || !coreFilled}
            onClick={() => void handleTest()}
            size="small"
            variant="outlined"
          >
            {busy === 'test'
              ? t('LW.desktop.settings.entity_backup.testing')
              : t('LW.desktop.settings.entity_backup.test')}
          </Button>
          <Button
            disabled={busy !== null || !encryptionAvailable}
            onClick={() => void handleSave()}
            size="small"
            variant="contained"
          >
            {busy === 'save'
              ? t('LW.desktop.settings.entity_backup.saving')
              : t('LW.desktop.settings.entity_backup.save')}
          </Button>
          <Button
            disabled={busy !== null || !secretKnown || !patch.bucket}
            onClick={() => void handleBackupNow()}
            size="small"
            variant="outlined"
          >
            {busy === 'backup'
              ? t('LW.desktop.settings.entity_backup.backing_up')
              : t('LW.desktop.settings.entity_backup.backup_now')}
          </Button>
          <Button onClick={() => void handleToggleRestore()} size="small" variant="text">
            {showRestore
              ? t('LW.desktop.settings.entity_backup.restore_hide')
              : t('LW.desktop.settings.entity_backup.restore_show')}
          </Button>
        </Box>

        {status.lastBackup && (
          <Typography color="text.secondary" component="p" variant="caption">
            {t('LW.desktop.settings.entity_backup.last_backup', {
              when: formatWhen(status.lastBackup.at),
              size: formatMB(status.lastBackup.uploadedBytes),
              reason: status.lastBackup.reason,
            })}
          </Typography>
        )}

        <Collapse in={showRestore}>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <Alert severity="warning" sx={{ py: 0 }}>
              {t('LW.desktop.settings.entity_backup.restore_warning')}
            </Alert>
            {snapshots === null ? (
              <Typography variant="caption">
                {t('LW.desktop.settings.entity_backup.loading_snapshots')}
              </Typography>
            ) : snapshots.length === 0 ? (
              <Typography variant="caption">
                {t('LW.desktop.settings.entity_backup.no_snapshots')}
              </Typography>
            ) : (
              <TextField
                fullWidth
                label={t('LW.desktop.settings.entity_backup.snapshot')}
                onChange={(event) => setRestoreKey(event.target.value)}
                select
                size="small"
                value={restoreKey}
              >
                {snapshots.slice(0, 20).map((snap) => (
                  <MenuItem key={snap.key} value={snap.key}>
                    {formatWhen(snap.timestamp)} · {formatMB(snap.size)} · {snap.reason}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {snapshots && snapshots.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {restoreArmed ? (
                  <>
                    <Button
                      color="error"
                      disabled={busy !== null}
                      onClick={() => void handleRestore()}
                      size="small"
                      variant="contained"
                    >
                      {busy === 'restore'
                        ? t('LW.desktop.settings.entity_backup.restoring')
                        : t('LW.desktop.settings.entity_backup.restore_confirm')}
                    </Button>
                    <Button
                      disabled={busy !== null}
                      onClick={() => setRestoreArmed(false)}
                      size="small"
                      variant="text"
                    >
                      {t('LW.desktop.settings.entity_backup.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    color="error"
                    disabled={busy !== null || !restoreKey}
                    onClick={() => setRestoreArmed(true)}
                    size="small"
                    variant="outlined"
                  >
                    {t('LW.desktop.settings.entity_backup.restore')}
                  </Button>
                )}
              </Box>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </ListItem>
  );
};
