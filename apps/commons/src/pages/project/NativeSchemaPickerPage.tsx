import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { isDesktop } from '@src/types/desktop';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

interface SchemaOption {
  id: string;
  name: string;
}

interface SchemaPickerState {
  defaultSchemaId: string | null;
  schemas: SchemaOption[];
}

export const NativeSchemaPickerPage = () => {
  const [searchParams] = useSearchParams();
  const dialogId = searchParams.get('dialogId') ?? '';
  const { t } = useTranslation();
  const [state, setState] = useState<SchemaPickerState | null>(null);
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const invoke = useCallback(
    async (method: string, args?: unknown) => {
      return window.electronAPI?.nativeDialogInvoke({ dialogId, method, args });
    },
    [dialogId],
  );

  const closeDialog = useCallback(() => {
    void window.electronAPI?.closeNativeDialog(dialogId);
  }, [dialogId]);

  const handleCancel = useCallback(async () => {
    await invoke('cancelSchemaPicker', { dialogId });
    closeDialog();
  }, [closeDialog, dialogId, invoke]);

  useEffect(() => {
    if (!isDesktop() || !dialogId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void handleCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [dialogId, handleCancel]);

  useEffect(() => {
    if (!isDesktop() || !dialogId) return;

    void (async () => {
      const pickerState = (await invoke('getSchemaPickerState', { dialogId })) as
        | SchemaPickerState
        | null;
      if (pickerState) {
        setState(pickerState);
        setSelectedSchemaId(pickerState.defaultSchemaId ?? pickerState.schemas[0]?.id ?? '');
      }
      setLoading(false);
    })();
  }, [dialogId, invoke]);

  const handleSchemaChange = (event: SelectChangeEvent) => {
    setSelectedSchemaId(event.target.value);
  };

  const handleSelect = async () => {
    if (!selectedSchemaId || submitting) return;

    setSubmitting(true);
    try {
      await invoke('applySchemaPickerSelection', { dialogId, schemaId: selectedSchemaId });
      closeDialog();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isDesktop()) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>This page is only available in the desktop app.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          WebkitAppRegion: 'drag',
        }}
      >
        <Typography sx={{ textTransform: 'capitalize' }} variant="h6">
          {t('LW.Select schema')}
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ flex: 1, p: 2, WebkitAppRegion: 'no-drag' }}>
        {loading || !state ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <>
            <FormControl fullWidth size="small">
              <InputLabel id="native-schema-label" sx={{ textTransform: 'capitalize' }}>
                {t('LW.commons.schema')}
              </InputLabel>
              <Select
                disabled={state.schemas.length === 0}
                fullWidth
                label={t('LW.commons.schema')}
                labelId="native-schema-label"
                onChange={handleSchemaChange}
                value={selectedSchemaId}
              >
                {state.schemas.map(({ id, name }) => (
                  <MenuItem key={id} sx={{ textTransform: 'uppercase' }} value={id}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="caption">
              <Box component="span" sx={{ textDecoration: 'underline', textTransform: 'uppercase' }}>
                {t('LW.note')}:
              </Box>
              {` ${t(
                'LW.LEAF-Writer cannot guarantee that the document will work correctly with the selected schema',
              )}. ${t('LW.Tagging might not work as expected')}.`}
            </Typography>
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
          WebkitAppRegion: 'no-drag',
        }}
      >
        <Button disabled={submitting} onClick={() => void handleCancel()}>
          {t('LW.commons.cancel')}
        </Button>
        <Button
          color="primary"
          disabled={!selectedSchemaId || submitting}
          onClick={() => void handleSelect()}
          variant="outlined"
        >
          {t('LW.commons.select')}
        </Button>
      </Box>
    </Box>
  );
};
