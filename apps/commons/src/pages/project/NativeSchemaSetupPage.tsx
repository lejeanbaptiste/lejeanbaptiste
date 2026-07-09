import { useSearchParams } from 'react-router';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { getTieredCatalogForSetup } from '@src/desktop/schemaCatalog';
import { isDesktop } from '@src/types/desktop';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SchemaSetupState {
  primary: Array<{ id: string; name: string; enabled: boolean }>;
  more: Array<{ id: string; name: string; enabled: boolean; comingSoon?: boolean }>;
  defaultCatalogId: string;
}

export const NativeSchemaSetupPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const dialogId = searchParams.get('dialogId') ?? '';
  const [state, setState] = useState<SchemaSetupState | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(
    async (method: string, args?: unknown) => {
      return window.electronAPI?.nativeDialogInvoke({ dialogId, method, args });
    },
    [dialogId],
  );

  const closeDialog = useCallback(() => {
    void window.electronAPI?.closeNativeDialog(dialogId);
  }, [dialogId]);

  useEffect(() => {
    if (!isDesktop() || !dialogId) return;

    void (async () => {
      const setupState = (await invoke('getSchemaSetupState', { dialogId })) as
        | SchemaSetupState
        | null;
      if (setupState) {
        setState(setupState);
        setSelectedCatalogId(setupState.defaultCatalogId);
      } else {
        const tiered = getTieredCatalogForSetup();
        setState({
          primary: tiered.primary,
          more: tiered.more,
          defaultCatalogId: tiered.primary[0]?.id ?? 'teiAll',
        });
        setSelectedCatalogId(tiered.primary[0]?.id ?? 'teiAll');
      }
      setLoading(false);
    })();
  }, [dialogId, invoke]);

  const handleDownload = async () => {
    if (!selectedCatalogId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = (await invoke('installCatalogSchema', {
        dialogId,
        catalogId: selectedCatalogId,
      })) as { ok: boolean; error?: string };
      if (!result?.ok) {
        setError(result?.error ?? 'Schema download failed.');
        return;
      }
      closeDialog();
    } catch {
      setError('Schema download failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocalSchema = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = (await invoke('installLocalSchema', { dialogId })) as {
        ok: boolean;
        error?: string;
      };
      if (!result?.ok) {
        if (result?.error !== 'cancelled') {
          setError(result?.error ?? 'Could not copy schema file.');
        }
        return;
      }
      closeDialog();
    } catch {
      setError('Could not copy schema file.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isDesktop()) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('LWC.desktop.only_available_desktop')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', WebkitAppRegion: 'drag' }}>
        <Typography variant="h6">{t('LWC.desktop.project.schema_setup')}</Typography>
        <Typography color="text.secondary" variant="body2">
          {t('LWC.desktop.project.choose_schema_message')}
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ flex: 1, p: 2, WebkitAppRegion: 'no-drag', overflow: 'auto' }}>
        {loading || !state ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <>
            <FormControl fullWidth size="small">
              <InputLabel id="schema-setup-label">{t('LWC.desktop.project.schema')}</InputLabel>
              <Select
                label={t('LWC.desktop.project.schema')}
                labelId="schema-setup-label"
                onChange={(event) => setSelectedCatalogId(event.target.value)}
                value={selectedCatalogId}
              >
                {state.primary.map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </MenuItem>
                ))}
                {state.more.map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </>
        )}
      </Stack>

      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1,
          WebkitAppRegion: 'no-drag',
        }}
      >
        <Button disabled={submitting} onClick={() => void handleLocalSchema()} variant="outlined">
          Use local schema file…
        </Button>
        <Button
          color="primary"
          disabled={!selectedCatalogId || submitting}
          onClick={() => void handleDownload()}
          variant="contained"
        >
          Download
        </Button>
      </Box>
    </Box>
  );
};
