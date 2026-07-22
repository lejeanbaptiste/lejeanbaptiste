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
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import { useActions, useAppState } from '@src/overmind';
import type { TimeMachineSnapshotSummary } from '@src/types/desktop';
import { unlockAchievement } from '@src/desktop/achievements/engine';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TimeMachineDialogProps {
  onClose: () => void;
  open: boolean;
}

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
  const [snapshots, setSnapshots] = useState<TimeMachineSnapshotSummary[]>([]);
  const [busyAction, setBusyAction] = useState<'backup' | 'load' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectName = useMemo(() => config?.name?.trim() || 'Untitled project', [config?.name]);
  const isBusy = busyAction !== null;

  const loadSnapshots = useCallback(async () => {
    if (!open || !rootPath || !window.electronAPI?.listTimeMachineSnapshots) return;
    setBusyAction('load');
    setError(null);
    try {
      setSnapshots(await window.electronAPI.listTimeMachineSnapshots(rootPath));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load snapshots.');
    } finally {
      setBusyAction(null);
    }
  }, [open, rootPath]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const handleBackup = async () => {
    if (!rootPath || !window.electronAPI?.createTimeMachineSnapshot) return;
    setBusyAction('backup');
    setError(null);

    try {
      const saveResult = await saveAllDirtyTabs();
      if (!saveResult.ok) {
        setError(saveResult.error ?? 'Could not save open files before backup.');
        return;
      }

      const snapshot = await window.electronAPI.createTimeMachineSnapshot(rootPath, projectName);
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

  const handleRestore = async (snapshot: TimeMachineSnapshotSummary) => {
    if (!rootPath || !window.electronAPI?.restoreTimeMachineSnapshotToProject) {
      return;
    }

    setBusyAction('restore');
    setError(null);
    try {
      const confirmation = await window.electronAPI.showNativeMessageBox({
        type: 'warning',
        title: t('LWC.desktop.time_machine.restore_snapshot'),
        message: t('LWC.desktop.time_machine.restore_snapshot_message'),
        buttons: [t('LWC.desktop.time_machine.restore'), t('LWC.desktop.time_machine.cancel')],
        cancelId: 1,
        defaultId: 1,
      });

      if (confirmation.response !== 0) return;

      const saveResult = await saveAllDirtyTabs();
      if (!saveResult.ok) {
        setError(saveResult.error ?? 'Could not save open files before restore.');
        return;
      }

      await window.electronAPI.restoreTimeMachineSnapshotToProject(
        rootPath,
        projectName,
        snapshot.path,
      );
      await reloadDirectoryInTree(rootPath);
      await Promise.all(openTabs.map((tab) => reloadTabFromDisk(tab.filePath)));
      await loadSnapshots();
      await unlockAchievement('recovery-under-fire', (message) =>
        notifyViaSnackbar({
          message,
          options: { variant: 'success', autoHideDuration: 7000 },
        }),
      );
      notifyViaSnackbar({
        message: t('LWC.desktop.time_machine.project_restored'),
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
          {!isProjectReady || !rootPath ? (
            <Alert severity="info">{t('LWC.desktop.time_machine.open_project_first')}</Alert>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Box>
            <Typography variant="subtitle2">{projectName}</Typography>
            <Typography color="text.secondary" noWrap title={rootPath ?? ''} variant="body2">
              {rootPath}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              disabled={!rootPath || isBusy}
              onClick={() => void handleBackup()}
              startIcon={busyAction === 'backup' ? <CircularProgress size={16} /> : <AddIcon />}
              variant="contained"
            >
              {t('LWC.desktop.time_machine.back_up_now')}
            </Button>
            <Tooltip title={t('LWC.desktop.time_machine.refresh_snapshots')}>
              <span>
                <IconButton
                  disabled={!rootPath || isBusy}
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
                    <Tooltip title={t('LWC.desktop.time_machine.restore_to_current_project')}>
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
