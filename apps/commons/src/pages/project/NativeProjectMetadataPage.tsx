import { useSearchParams } from 'react-router';
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { isDesktop } from '@src/types/desktop';
import type { ProjectMetadataDialogState } from '@src/desktop/projectMetadataDialogState';
import { useCallback, useEffect, useState } from 'react';

export const NativeProjectMetadataPage = () => {
  const [searchParams] = useSearchParams();
  const initialDialogId = searchParams.get('dialogId') ?? '';
  const [activeDialogId, setActiveDialogId] = useState(initialDialogId);
  const [state, setState] = useState<ProjectMetadataDialogState | null>(null);
  const [loading, setLoading] = useState(
    initialDialogId !== '__prewarm__' && Boolean(initialDialogId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(
    async (method: string, args?: unknown) => {
      return window.electronAPI?.nativeDialogInvoke({ dialogId: activeDialogId, method, args });
    },
    [activeDialogId],
  );

  const closeDialog = useCallback(() => {
    void window.electronAPI?.closeNativeDialog(activeDialogId);
  }, [activeDialogId]);

  const applyDialogState = useCallback((dialogState: ProjectMetadataDialogState | null) => {
    if (dialogState) {
      setState(dialogState);
      setError(null);
    } else {
      setError('Could not load edition metadata.');
    }
    setLoading(false);
  }, []);

  const loadDialogState = useCallback(
    async (dialogId: string, prefetched?: ProjectMetadataDialogState) => {
      if (prefetched) {
        applyDialogState(prefetched);
        return;
      }
      setLoading(true);
      const dialogState = (await window.electronAPI?.nativeDialogInvoke({
        dialogId,
        method: 'getProjectMetadataState',
        args: { dialogId },
      })) as ProjectMetadataDialogState | null;
      applyDialogState(dialogState);
    },
    [applyDialogState],
  );

  useEffect(() => {
    if (!isDesktop()) return;
    const unsubOpen = window.electronAPI?.onNativeDialogOpen?.((payload) => {
      setActiveDialogId(payload.dialogId);
      setState(null);
      setError(null);
      const prefetched = payload.initialState as ProjectMetadataDialogState | undefined;
      void loadDialogState(payload.dialogId, prefetched);
    });
    const unsubState = window.electronAPI?.onNativeDialogStateUpdate?.((payload) => {
      applyDialogState(payload.initialState as ProjectMetadataDialogState);
    });
    return () => {
      unsubOpen?.();
      unsubState?.();
    };
  }, [applyDialogState, loadDialogState]);

  const updateField = (path: string, value: string) => {
    setState((prev) =>
      prev ? { ...prev, values: { ...prev.values, [path]: value } } : prev,
    );
  };

  const updateCustom = (
    index: number,
    key: 'path' | 'label' | 'value',
    value: string,
  ) => {
    setState((prev) => {
      if (!prev) return prev;
      const custom = prev.custom.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      );
      return { ...prev, custom };
    });
  };

  const addCustomRow = () => {
    setState((prev) =>
      prev
        ? {
            ...prev,
            custom: [...prev.custom, { path: '', label: '', value: '' }],
          }
        : prev,
    );
  };

  const removeCustomRow = (index: number) => {
    setState((prev) =>
      prev
        ? { ...prev, custom: prev.custom.filter((_, i) => i !== index) }
        : prev,
    );
  };

  const handleSave = async (applyToDocuments: boolean) => {
    if (!state || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = (await invoke('saveProjectMetadata', {
        values: state.values,
        custom: state.custom,
        applyToDocuments,
      })) as { ok: boolean; error?: string; summary?: string };
      if (!result?.ok) {
        setError(result?.error ?? 'Could not save metadata.');
        return;
      }
      closeDialog();
    } catch {
      setError('Could not save metadata.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    await invoke('cancelProjectMetadata', {});
    closeDialog();
  };

  if (!isDesktop()) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>This page is only available in the desktop app.</Typography>
      </Box>
    );
  }

  const isFirstSetup = state?.mode === 'firstSetup';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', WebkitAppRegion: 'drag' }}>
        <Typography variant="h6">
          {isFirstSetup ? 'Project metadata' : 'Edition metadata'}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {isFirstSetup
            ? 'Save once to finish project setup. Fields may be left blank.'
            : 'Project-wide defaults stored in schema/project-metadata.json.'}
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ flex: 1, p: 2, WebkitAppRegion: 'no-drag', overflow: 'auto' }}>
        {loading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : !state ? (
          <Typography color="error" variant="body2">
            {error ?? 'Could not load edition metadata.'}
          </Typography>
        ) : (
          <>
            {state.note && (
              <Typography color="text.secondary" variant="body2">
                {state.note}
              </Typography>
            )}

            {state.fields.map((field) => (
              <TextField
                fullWidth
                key={field.path}
                label={field.label}
                multiline={field.path.includes('projectDesc')}
                onChange={(event) => updateField(field.path, event.target.value)}
                size="small"
                value={state.values[field.path] ?? ''}
              />
            ))}

            <Typography sx={{ pt: 1 }} variant="subtitle2">
              Custom fields
            </Typography>

            {state.custom.map((row, index) => (
              <Stack direction="row" key={`custom-${index}`} spacing={1}>
                <TextField
                  label="TEI path"
                  onChange={(event) => updateCustom(index, 'path', event.target.value)}
                  size="small"
                  sx={{ flex: 1.2 }}
                  value={row.path}
                />
                <TextField
                  label="Label"
                  onChange={(event) => updateCustom(index, 'label', event.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  value={row.label}
                />
                <TextField
                  label="Value"
                  onChange={(event) => updateCustom(index, 'value', event.target.value)}
                  size="small"
                  sx={{ flex: 1.2 }}
                  value={row.value}
                />
                <IconButton aria-label="Remove custom field" onClick={() => removeCustomRow(index)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            ))}

            <Button onClick={addCustomRow} size="small" variant="text">
              Add custom field
            </Button>

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
          justifyContent: 'flex-end',
          gap: 1,
          WebkitAppRegion: 'no-drag',
        }}
      >
        {!isFirstSetup && (
          <Button disabled={submitting} onClick={() => void handleCancel()}>
            Cancel
          </Button>
        )}
        {!isFirstSetup && (
          <Button
            disabled={submitting}
            onClick={() => void handleSave(false)}
            variant="outlined"
          >
            Save defaults only
          </Button>
        )}
        <Button
          color="primary"
          disabled={submitting || !state}
          onClick={() => void handleSave(!isFirstSetup)}
          variant="contained"
        >
          {isFirstSetup ? 'Save' : 'Save and update documents…'}
        </Button>
      </Box>
    </Box>
  );
};
