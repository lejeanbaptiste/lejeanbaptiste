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
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BridgeInboxReport } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/bridgeInbox';
import { useAppState } from '@src/overmind';
import {
  applyPendingCentralOrders,
  computeBridgeInbox,
  loadBridgeContext,
  promoteEntities,
  syncEntities,
  type BridgeContext,
} from '../entityDb/bridge';
import { BridgeConflictResolver } from './BridgeConflictResolver';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after Promote/Sync changes either database, so the parent can reload. */
  onChanged?: () => void;
}

/**
 * The Bridge inbox: shows how this project's database lines up with the user's
 * central database and offers Promote (link unlinked entities) and Sync
 * (propagate non-conflicting differences). Conflicts and broken links are
 * listed for the user; corpus keys are never touched here.
 */
export const BridgeInboxDialog = ({ open, onClose, onChanged }: Props) => {
  const { t } = useTranslation();
  const { rootPath } = useAppState().project;
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<BridgeContext | null>(null);
  const [report, setReport] = useState<BridgeInboxReport | null>(null);
  const [centralOrdersNote, setCentralOrdersNote] = useState<string | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<{
    pedbId: string;
    centralId: string;
  } | null>(null);

  const refresh = useCallback(async (ctx: BridgeContext) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await computeBridgeInbox(ctx));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setReport(null);
    setUnavailable(null);
    setError(null);
    setCentralOrdersNote(null);
    setSelectedConflict(null);
    setBusy(null);
    void (async () => {
      const availability = await loadBridgeContext();
      if (!availability.available) {
        setContext(null);
        setUnavailable(availability.reason);
        return;
      }
      setContext(availability.context);
      // Converge against any central-database merges/deletes this project
      // hasn't seen yet before showing the inbox — otherwise a just-merged
      // duplicate would still show up here as "broken".
      try {
        const synced = await applyPendingCentralOrders(availability.context);
        if (synced.repointed > 0 || synced.cleared > 0) {
          setCentralOrdersNote(
            t('LWC.desktop.sidebar.database.bridge.central_updates', {
              orders: synced.ordersApplied,
              repointed: synced.repointed,
              cleared: synced.cleared,
            }),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      await refresh(availability.context);
    })();
  }, [open, refresh, rootPath, t]);

  const runAction = async (label: string, action: (ctx: BridgeContext) => Promise<unknown>) => {
    if (!context) return;
    setBusy(label);
    setError(null);
    try {
      await action(context);
      // Promote/sync itself is cheap; drop the action spinner before the inbox
      // refresh so a large central database never looks like "still promoting".
      setBusy(null);
      await refresh(context);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const promoteAll = () =>
    runAction(t('LWC.desktop.sidebar.database.bridge.promoting'), (ctx) =>
      promoteEntities(
        ctx,
        report!.unlinked.map((u) => u.id),
      ),
    );

  const syncAll = () =>
    runAction(t('LWC.desktop.sidebar.database.bridge.syncing'), (ctx) =>
      syncEntities(
        ctx,
        report!.syncable.map((s) => ({ pedbId: s.id, centralId: s.centralId })),
      ),
    );

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{t('LWC.desktop.sidebar.database.bridge.title')}</DialogTitle>
        <DialogContent dividers>
          {unavailable && <Alert severity="info">{unavailable}</Alert>}
          {centralOrdersNote && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setCentralOrdersNote(null)}>
              {centralOrdersNote}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {!unavailable && (loading || busy) && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">
                {busy ?? t('LWC.desktop.sidebar.database.bridge.loading')}
              </Typography>
            </Stack>
          )}
          {report && !loading && !busy && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {t('LWC.desktop.sidebar.database.bridge.summary', {
                  inSync: report.inSyncCount,
                  syncable: report.syncable.length,
                  unlinked: report.unlinked.length,
                  conflicts: report.conflicts.length,
                  broken: report.broken.length,
                })}
              </Typography>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={report.unlinked.length === 0}
                  onClick={promoteAll}
                >
                  {t('LWC.desktop.sidebar.database.bridge.promote', {
                    count: report.unlinked.length,
                  })}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={report.syncable.length === 0}
                  onClick={syncAll}
                >
                  {t('LWC.desktop.sidebar.database.bridge.sync', { count: report.syncable.length })}
                </Button>
              </Stack>

              {report.conflicts.length > 0 && (
                <Box>
                  <Divider textAlign="left" sx={{ mb: 1 }}>
                    <Typography variant="caption">
                      {t('LWC.desktop.sidebar.database.bridge.conflicts')}
                    </Typography>
                  </Divider>
                  <List dense disablePadding>
                    {report.conflicts.map((c) => (
                      <ListItem
                        key={c.id}
                        disableGutters
                        secondaryAction={
                          <Button
                            size="small"
                            onClick={() =>
                              setSelectedConflict({ pedbId: c.id, centralId: c.centralId })
                            }
                          >
                            {t('LWC.desktop.sidebar.database.bridge.resolve')}
                          </Button>
                        }
                      >
                        <ListItemText
                          primary={c.name}
                          secondary={t('LWC.desktop.sidebar.database.bridge.disagrees_on', {
                            fields: c.fields.join(', '),
                          })}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {report.broken.length > 0 && (
                <Box>
                  <Divider textAlign="left" sx={{ mb: 1 }}>
                    <Typography variant="caption">
                      {t('LWC.desktop.sidebar.database.bridge.broken_links')}
                    </Typography>
                  </Divider>
                  <List dense disablePadding>
                    {report.broken.map((b) => (
                      <ListItem key={b.id} disableGutters>
                        <ListItemText primary={b.name} secondary={b.centralId} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('LWC.desktop.sidebar.database.bridge.close')}</Button>
        </DialogActions>
      </Dialog>
      {selectedConflict && context && (
        <BridgeConflictResolver
          context={context}
          pedbId={selectedConflict.pedbId}
          centralId={selectedConflict.centralId}
          onClose={() => setSelectedConflict(null)}
          onResolved={() => {
            setSelectedConflict(null);
            void refresh(context);
            onChanged?.();
          }}
        />
      )}
    </>
  );
};
