import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import { useActions, useAppState } from '@src/overmind';
import type { TimeMachineSnapshotSummary } from '@src/types/desktop';
import { unlockAchievement, recordTimeMachineRun } from '@src/desktop/achievements/engine';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ORDERS_FILE,
  unionOrderLogs,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityOrders';
import { joinPath } from '../../../../packages/cwrc-leafwriter/src/autoTagging/pathJoin';

interface TimeMachineDialogProps {
  onClose: () => void;
  open: boolean;
}

type TimeMachineMode = 'project' | 'central';

const CENTRAL_SNAPSHOT_NAME = 'Central entity database';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
};

export const TimeMachineDialog = ({ onClose, open }: TimeMachineDialogProps) => {
  const { t } = useTranslation();
  const { config, isProjectReady, openTabs, rootPath } = useAppState().project;
  const { reloadDirectoryInTree, reloadTabFromDisk, saveAllDirtyTabs } = useActions().project;
  const { notifyViaSnackbar } = useActions().ui;
  const [mode, setMode] = useState<TimeMachineMode>('project');
  const [centralFolder, setCentralFolder] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<TimeMachineSnapshotSummary[]>([]);
  const [busyAction, setBusyAction] = useState<'backup' | 'load' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectName = useMemo(() => config?.name?.trim() || 'Untitled project', [config?.name]);
  const isBusy = busyAction !== null;

  // The two timelines are deliberately separate: the project tab snapshots the
  // project tree; the central tab snapshots the central entity DB folder
  // (entities.xml + order log + registry), whose history roams with the folder.
  const activeRoot = mode === 'project' ? rootPath : centralFolder;
  const activeName = mode === 'project' ? projectName : CENTRAL_SNAPSHOT_NAME;

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        setCentralFolder((await window.electronAPI?.getEntityDbFolder?.()) ?? null);
      } catch {
        setCentralFolder(null);
      }
    })();
    void recordTimeMachineRun((message) =>
      notifyViaSnackbar({
        message,
        options: { variant: 'success', autoHideDuration: 7000 },
      }),
    );
    // Count each open once; omit notifyViaSnackbar so parent re-renders don't
    // inflate timeMachineRuns while the dialog stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open]);

  const loadSnapshots = useCallback(async () => {
    if (!open || !activeRoot || !window.electronAPI?.listTimeMachineSnapshots) {
      setSnapshots([]);
      return;
    }
    setBusyAction('load');
    setError(null);
    try {
      setSnapshots(await window.electronAPI.listTimeMachineSnapshots(activeRoot));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load snapshots.');
    } finally {
      setBusyAction(null);
    }
  }, [open, activeRoot]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const handleBackup = async () => {
    if (!activeRoot || !window.electronAPI?.createTimeMachineSnapshot) return;
    setBusyAction('backup');
    setError(null);

    try {
      if (mode === 'project') {
        const saveResult = await saveAllDirtyTabs();
        if (!saveResult.ok) {
          setError(saveResult.error ?? 'Could not save open files before backup.');
          return;
        }
      }

      const snapshot = await window.electronAPI.createTimeMachineSnapshot(activeRoot, activeName);
      setSnapshots((current) => [snapshot, ...current]);
      notifyViaSnackbar({
        message: t('LWC.desktop.time_machine.snapshot_created'),
        options: { variant: 'success' },
      });
    } catch (backupError) {
      setError(
        backupError instanceof Error
          ? backupError.message
          : t('LWC.desktop.time_machine.could_not_create_snapshot'),
      );
    } finally {
      setBusyAction(null);
    }
  };

  /**
   * Restoring the central folder must not lose merge/delete orders recorded
   * since the snapshot: the order log is append-only propagation truth that
   * other checkouts may not have applied yet. Union the pre-restore log back
   * into the restored one.
   */
  const restoreCentralPreservingOrders = async (snapshotPath: string) => {
    const api = window.electronAPI!;
    const ordersPath = joinPath(centralFolder!, ORDERS_FILE);
    let preRestoreLog = '';
    try {
      if (await api.pathExists(ordersPath)) preRestoreLog = await api.readFile(ordersPath);
    } catch {
      preRestoreLog = '';
    }

    await api.restoreTimeMachineSnapshotToProject(centralFolder!, CENTRAL_SNAPSHOT_NAME, snapshotPath);

    if (preRestoreLog.trim()) {
      let restoredLog = '';
      try {
        if (await api.pathExists(ordersPath)) restoredLog = await api.readFile(ordersPath);
      } catch {
        restoredLog = '';
      }
      const merged = unionOrderLogs(preRestoreLog, restoredLog);
      if (merged !== restoredLog) await api.writeFile(ordersPath, merged);
    }
  };

  const handleRestore = async (snapshot: TimeMachineSnapshotSummary) => {
    if (!activeRoot || !window.electronAPI?.restoreTimeMachineSnapshotToProject) {
      return;
    }

    setBusyAction('restore');
    setError(null);
    try {
      const confirmation = await window.electronAPI.showNativeMessageBox({
        type: 'warning',
        title: t('LWC.desktop.time_machine.restore_snapshot'),
        message:
          mode === 'central'
            ? 'Restore the central entity database to this snapshot? Merge/delete orders recorded since then are preserved. Projects linked to this database may report unresolved keys afterwards — review the sync prompts on next open.'
            : t('LWC.desktop.time_machine.restore_snapshot_message'),
        buttons: [t('LWC.desktop.time_machine.restore'), t('LWC.desktop.time_machine.cancel')],
        cancelId: 1,
        defaultId: 1,
      });

      if (confirmation.response !== 0) return;

      if (mode === 'project') {
        const saveResult = await saveAllDirtyTabs();
        if (!saveResult.ok) {
          setError(saveResult.error ?? 'Could not save open files before restore.');
          return;
        }
        await window.electronAPI.restoreTimeMachineSnapshotToProject(
          activeRoot,
          activeName,
          snapshot.path,
        );
        await reloadDirectoryInTree(activeRoot);
        await Promise.all(openTabs.map((tab) => reloadTabFromDisk(tab.filePath)));
        await unlockAchievement('recovery-under-fire', (message) =>
          notifyViaSnackbar({
            message,
            options: { variant: 'success', autoHideDuration: 7000 },
          }),
        );
      } else {
        await restoreCentralPreservingOrders(snapshot.path);
      }

      await loadSnapshots();
      notifyViaSnackbar({
        message:
          mode === 'central'
            ? 'Central entity database restored.'
            : t('LWC.desktop.time_machine.project_restored'),
        options: { variant: 'success' },
      });
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : t('LWC.desktop.time_machine.could_not_restore_snapshot'),
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" onClose={isBusy ? undefined : onClose} open={open}>
      <DialogTitle>{t('LWC.desktop.time_machine.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Tabs
            onChange={(_event, value: TimeMachineMode) => setMode(value)}
            value={mode}
            variant="fullWidth"
          >
            <Tab label={t('LWC.desktop.time_machine.title_project', 'Project')} value="project" />
            <Tab
              label={t('LWC.desktop.time_machine.title_central', 'Entity database')}
              value="central"
            />
          </Tabs>

          {mode === 'project' && (!isProjectReady || !rootPath) ? (
            <Alert severity="info">{t('LWC.desktop.time_machine.open_project_first')}</Alert>
          ) : null}
          {mode === 'central' && !centralFolder ? (
            <Alert severity="info">
              No central entity database folder is configured (App Settings).
            </Alert>
          ) : null}
          {mode === 'central' ? (
            <Alert severity="info" sx={{ py: 0 }}>
              Restoring one timeline never restores the other: corpus files live in project
              snapshots, the entity database in these.
            </Alert>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Box>
            <Typography variant="subtitle2">{activeName}</Typography>
            <Typography color="text.secondary" noWrap title={activeRoot ?? ''} variant="body2">
              {activeRoot}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              disabled={!activeRoot || isBusy}
              onClick={() => void handleBackup()}
              startIcon={busyAction === 'backup' ? <CircularProgress size={16} /> : <AddIcon />}
              variant="contained"
            >
              {t('LWC.desktop.time_machine.back_up_now')}
            </Button>
            <Tooltip title={t('LWC.desktop.time_machine.refresh_snapshots')}>
              <span>
                <IconButton
                  disabled={!activeRoot || isBusy}
                  onClick={() => void loadSnapshots()}
                  size="small"
                >
                  {busyAction === 'load' ? <CircularProgress size={18} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <Divider />

          {snapshots.length === 0 && busyAction !== 'load' ? (
            <Typography color="text.secondary" variant="body2">
              {t('LWC.desktop.time_machine.no_snapshots_yet')}
            </Typography>
          ) : (
            <List disablePadding>
              {snapshots.map((snapshot) => (
                <ListItem
                  disableGutters
                  key={snapshot.id}
                  secondaryAction={
                    <Tooltip
                      title={
                        mode === 'central'
                          ? 'Restore the central entity database'
                          : t('LWC.desktop.time_machine.restore_to_current_project')
                      }
                    >
                      <span>
                        <IconButton
                          disabled={isBusy}
                          edge="end"
                          onClick={() => void handleRestore(snapshot)}
                        >
                          <RestoreIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  }
                >
                  <ListItemText
                    primary={formatDate(snapshot.createdAt)}
                    secondary={`${snapshot.fileCount} file(s), ${formatBytes(snapshot.sizeBytes)}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={isBusy} onClick={onClose}>
          {t('LWC.desktop.time_machine.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
