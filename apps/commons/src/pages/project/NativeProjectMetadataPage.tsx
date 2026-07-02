import { useSearchParams } from 'react-router';
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { isDesktop } from '@src/types/desktop';
import {
  CITATION_STYLE_OPTIONS,
  DEFAULT_CITATION_STYLE_ID,
} from '@src/desktop/citations/styleOptions';
import type { ProjectMetadataDialogState } from '@src/desktop/projectMetadataDialogState';
import type { TranslationLanguage } from '@src/desktop/translationTypes';
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

  const [alignmentUnit, setAlignmentUnit] = useState<'div' | 'p'>('div');
  const [citationStyle, setCitationStyle] = useState<string>(DEFAULT_CITATION_STYLE_ID);
  const [languages, setLanguages] = useState<TranslationLanguage[]>([]);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangLabel, setNewLangLabel] = useState('');

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
      setAlignmentUnit(dialogState.translation.alignmentUnit ?? 'div');
      setCitationStyle(dialogState.translation.citationStyle ?? DEFAULT_CITATION_STYLE_ID);
      setLanguages(dialogState.translation.languages);
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

  const addLanguage = () => {
    const code = newLangCode.trim();
    const label = newLangLabel.trim() || code;
    if (!code || languages.some((lang) => lang.code === code)) return;
    setLanguages((prev) => [...prev, { code, label }]);
    setNewLangCode('');
    setNewLangLabel('');
  };

  const removeLanguage = (code: string) => {
    setLanguages((prev) => prev.filter((lang) => lang.code !== code));
  };

  const handleSave = async (applyToDocuments: boolean) => {
    if (!state || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Include a typed-but-not-yet-added language row so forgetting to click
      // "Add" before Save doesn't silently save zero languages.
      const pendingCode = newLangCode.trim();
      const languagesToSave =
        pendingCode && !languages.some((lang) => lang.code === pendingCode)
          ? [...languages, { code: pendingCode, label: newLangLabel.trim() || pendingCode }]
          : languages;

      const result = (await invoke('saveProjectMetadata', {
        values: state.values,
        custom: state.custom,
        applyToDocuments,
        translationAlignmentUnit: alignmentUnit,
        translationLanguages: languagesToSave,
        translationCitationStyle: citationStyle,
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

            <Typography sx={{ pt: 1 }} variant="subtitle2">
              Translation
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {state.translation.locked
                ? 'Alignment unit is locked once translations have started.'
                : 'Choose the granularity at which source and translation are linked. This cannot be changed later.'}
            </Typography>
            <RadioGroup
              row
              value={alignmentUnit}
              onChange={(event) => setAlignmentUnit(event.target.value as 'div' | 'p')}
            >
              <FormControlLabel
                control={<Radio disabled={state.translation.locked} />}
                label="Div (section-level, looser)"
                value="div"
              />
              <FormControlLabel
                control={<Radio disabled={state.translation.locked} />}
                label="Paragraph (1:1)"
                value="p"
              />
            </RadioGroup>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Languages
            </Typography>

            {languages.map((lang) => (
              <Stack alignItems="center" direction="row" key={lang.code} spacing={1}>
                <TextField disabled label="Code" size="small" sx={{ flex: 1 }} value={lang.code} />
                <TextField
                  disabled
                  label="Label"
                  size="small"
                  sx={{ flex: 2 }}
                  value={lang.label}
                />
                <IconButton aria-label="Remove language" onClick={() => removeLanguage(lang.code)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            ))}

            <TextField
              helperText="Style used for footnote citations in translations. Can be changed anytime; citations re-render."
              label="Citation style"
              onChange={(event) => setCitationStyle(event.target.value)}
              select
              size="small"
              SelectProps={{ native: true }}
              sx={{ maxWidth: 360 }}
              value={citationStyle}
            >
              {CITATION_STYLE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </TextField>

            <Stack alignItems="center" direction="row" spacing={1}>
              <TextField
                label="Code (e.g. fr)"
                onChange={(event) => setNewLangCode(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && addLanguage()}
                size="small"
                sx={{ flex: 1 }}
                value={newLangCode}
              />
              <TextField
                label="Label (e.g. Français)"
                onChange={(event) => setNewLangLabel(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && addLanguage()}
                size="small"
                sx={{ flex: 2 }}
                value={newLangLabel}
              />
              <Button onClick={addLanguage} size="small" variant="text">
                Add
              </Button>
            </Stack>

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
