import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScalarField } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/reconcile';
import {
  loadBridgeConflictPair,
  resolveBridgeConflict,
  type BridgeConflictChoice,
  type BridgeConflictPair,
  type BridgeContext,
} from '../entityDb/bridge';

const label: Record<ScalarField, string> = {
  description: 'Description',
  familyName: 'Family name',
  givenName: 'Given name',
  startYear: 'Birth / start year',
  endYear: 'Death / end year',
};

interface Props {
  context: BridgeContext;
  pedbId: string;
  centralId: string;
  onClose: () => void;
  onResolved: () => void;
}

export const BridgeConflictResolver = ({
  context,
  pedbId,
  centralId,
  onClose,
  onResolved,
}: Props) => {
  const { t } = useTranslation();
  const [pair, setPair] = useState<BridgeConflictPair | null>(null);
  const [choices, setChoices] = useState<Partial<Record<ScalarField, BridgeConflictChoice>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.__desktopLeftPanel?.collapse();
    window.__desktopRightPanel?.collapse();
    setPair(null);
    setChoices({});
    setError(null);
    void loadBridgeConflictPair(context, pedbId, centralId)
      .then(setPair)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [context, pedbId, centralId]);

  const apply = async () => {
    if (!pair) return;
    setBusy(true);
    setError(null);
    try {
      await resolveBridgeConflict(context, pair, choices);
      onResolved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open fullScreen onClose={onClose}>
      <DialogTitle>
        {pair?.name ?? t('LWC.desktop.sidebar.database.bridge.resolver_title')}{' '}
        <Typography component="span" color="text.secondary">
          {t('LWC.desktop.sidebar.database.bridge.project_central')}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!pair ? (
          <Typography>{t('LWC.desktop.sidebar.database.bridge.resolver_loading')}</Typography>
        ) : (
          <Stack spacing={2} sx={{ maxWidth: 1100, mx: 'auto' }}>
            <Typography color="text.secondary">
              {t('LWC.desktop.sidebar.database.bridge.resolver_help')}
            </Typography>
            {pair.conflicts.map((conflict) => (
              <Box
                key={conflict.field}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: 2,
                  alignItems: 'stretch',
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderColor: 'warning.main', textAlign: 'left' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('LWC.desktop.sidebar.database.bridge.project_field', {
                      field: label[conflict.field],
                    })}
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {String(conflict.pedbValue)}
                  </Typography>
                </Paper>
                <Stack alignItems="center" justifyContent="center">
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={choices[conflict.field] ?? 'defer'}
                    onChange={(_, value) =>
                      value && setChoices((old) => ({ ...old, [conflict.field]: value }))
                    }
                    orientation="vertical"
                  >
                    <ToggleButton value="pedb">
                      {t('LWC.desktop.sidebar.database.bridge.keep_project')}
                    </ToggleButton>
                    <ToggleButton value="defer">
                      {t('LWC.desktop.sidebar.database.bridge.defer')}
                    </ToggleButton>
                    <ToggleButton value="cedb">
                      {t('LWC.desktop.sidebar.database.bridge.keep_central')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderColor: 'warning.main', textAlign: 'right' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('LWC.desktop.sidebar.database.bridge.central_field', {
                      field: label[conflict.field],
                    })}
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {String(conflict.cedbValue)}
                  </Typography>
                </Paper>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('LWC.desktop.sidebar.database.bridge.back_to_inbox')}</Button>
        <Button variant="contained" disabled={!pair || busy} onClick={() => void apply()}>
          {t('LWC.desktop.sidebar.database.bridge.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
