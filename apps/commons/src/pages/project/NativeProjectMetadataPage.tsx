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
import {
  FIXED_LANGUAGE_OPTIONS,
  isKnownLanguageCode,
  languageLabelForCode,
} from '@cwrc/leafwriter/languageCodes';
import { isDesktop } from '@src/types/desktop';
import { SOURCE_LANGUAGE_PATH } from '@src/desktop/projectLanguage';
import type { ProjectMetadataDialogState } from '@src/desktop/projectMetadataDialogState';
import type { TranslationLanguage } from '@src/desktop/translationTypes';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const NativeProjectMetadataPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialDialogId = searchParams.get('dialogId') ?? '';
  const [activeDialogId, setActiveDialogId] = useState(initialDialogId);
  const [state, setState] = useState<ProjectMetadataDialogState | null>(null);
  const [loading, setLoading] = useState(
    initialDialogId !== '__prewarm__' && Boolean(initialDialogId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [alignmentUnit, setAlignmentUnit] = useState<'div' | 'p'>('p');
  const [languages, setLanguages] = useState<TranslationLanguage[]>([]);
  const [newLangCode, setNewLangCode] = useState('');

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
      setAlignmentUnit(dialogState.translation.alignmentUnit ?? 'p');
      setLanguages(dialogState.translation.languages);
      setError(null);
    } else {
      setError(t('LWC.desktop.project.errors.could_not_load_edition_metadata'));
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
    if (!code || languages.some((lang) => lang.code === code)) return;
    setLanguages((prev) => [...prev, { code, label: languageLabelForCode(code) }]);
    setNewLangCode('');
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
          ? [...languages, { code: pendingCode, label: languageLabelForCode(pendingCode) }]
          : languages;

      const result = (await invoke('saveProjectMetadata', {
        values: state.values,
        custom: state.custom,
        applyToDocuments,
        translationAlignmentUnit: alignmentUnit,
        translationLanguages: languagesToSave,
        entityStore: state.entityStore,
      })) as { ok: boolean; error?: string; summary?: string };
      if (!result?.ok) {
        setError(result?.error ?? t('LWC.desktop.project.errors.could_not_save_metadata'));
        return;
      }
      closeDialog();
    } catch {
      setError(t('LWC.desktop.project.errors.could_not_save_metadata'));
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
        <Typography>{t('LWC.desktop.only_available_desktop')}</Typography>
      </Box>
    );
  }

  const isFirstSetup = state?.mode === 'firstSetup';
  const requiresLanguage =
    state?.fields.some((field) => field.path === SOURCE_LANGUAGE_PATH) ?? false;
  const languageMissing =
    requiresLanguage && !(state?.values[SOURCE_LANGUAGE_PATH] ?? '').trim();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', WebkitAppRegion: 'drag' }}>
        <Typography variant="h6">{t('LWC.desktop.project.settings')}</Typography>
        <Typography color="text.secondary" variant="body2">
          {isFirstSetup
            ? t('LWC.desktop.project.first_setup_message')
            : t('LWC.desktop.project.defaults_message')}
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ flex: 1, p: 2, WebkitAppRegion: 'no-drag', overflow: 'auto' }}>
        {loading ? (
          <Typography color="text.secondary">{t('LWC.commons.loading')}</Typography>
        ) : !state ? (
          <Typography color="error" variant="body2">
            {error ?? t('LWC.desktop.project.errors.could_not_load_project_settings')}
          </Typography>
        ) : (
          <>
            {state.note && (
              <Typography color="text.secondary" variant="body2">
                {state.note}
              </Typography>
            )}

            {state.fields.map((field) =>
              field.path === SOURCE_LANGUAGE_PATH ? (
                <TextField
                  fullWidth
                  key={field.path}
                  label={field.label}
                  InputLabelProps={{ shrink: true }}
                  onChange={(event) => updateField(field.path, event.target.value)}
                  required
                  select
                  size="small"
                  SelectProps={{ native: true }}
                  value={state.values[field.path] ?? ''}
                >
                  <option value="">{t('LWC.desktop.project.select_language')}</option>
                  {/* Legacy free-text value from an older project: keep it selectable so
                      opening the dialog doesn't silently drop it. */}
                  {(state.values[field.path] ?? '') !== '' &&
                    !isKnownLanguageCode(state.values[field.path] ?? '') && (
                      <option value={state.values[field.path]}>
                        {state.values[field.path]} (legacy)
                      </option>
                    )}
                  {FIXED_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </TextField>
              ) : (
                <TextField
                  fullWidth
                  key={field.path}
                  label={field.label}
                  multiline={field.path.includes('projectDesc')}
                  onChange={(event) => updateField(field.path, event.target.value)}
                  size="small"
                  value={state.values[field.path] ?? ''}
                />
              ),
            )}

            <Typography sx={{ pt: 1 }} variant="subtitle2">
              {t('LWC.desktop.project.custom_fields')}
            </Typography>

            {state.custom.map((row, index) => (
              <Stack direction="row" key={`custom-${index}`} spacing={1}>
                <TextField
                  label={t('LWC.desktop.project.tei_path')}
                  onChange={(event) => updateCustom(index, 'path', event.target.value)}
                  size="small"
                  sx={{ flex: 1.2 }}
                  value={row.path}
                />
                <TextField
                  label={t('LWC.desktop.project.label')}
                  onChange={(event) => updateCustom(index, 'label', event.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  value={row.label}
                />
                <TextField
                  label={t('LWC.desktop.project.value')}
                  onChange={(event) => updateCustom(index, 'value', event.target.value)}
                  size="small"
                  sx={{ flex: 1.2 }}
                  value={row.value}
                />
                <IconButton aria-label={t('LWC.desktop.project.remove_custom_field')} onClick={() => removeCustomRow(index)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            ))}

            <Button onClick={addCustomRow} size="small" variant="text">
              {t('LWC.desktop.project.add_custom_field')}
            </Button>

            <Typography sx={{ pt: 1 }} variant="subtitle2">
              {t('LWC.desktop.project.entity_database')}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {t('LWC.desktop.project.entity_database_hint')}
            </Typography>
            <RadioGroup
              value={state.entityStore}
              onChange={(event) =>
                setState((prev) =>
                  prev
                    ? { ...prev, entityStore: event.target.value as 'central' | 'project' }
                    : prev,
                )
              }
            >
              <FormControlLabel control={<Radio size="small" />} label={t('LWC.desktop.project.central_database')} value="central" />
              <FormControlLabel
                control={<Radio size="small" />}
                label={t('LWC.desktop.project.project_database')}
                value="project"
              />
            </RadioGroup>

            <Typography sx={{ pt: 1 }} variant="subtitle2">
              {t('LWC.desktop.project.translation')}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {state.translation.locked
                ? t('LWC.desktop.project.alignment_unit_locked')
                : t('LWC.desktop.project.alignment_granularity_hint')}
            </Typography>
            <RadioGroup
              row
              value={alignmentUnit}
              onChange={(event) => setAlignmentUnit(event.target.value as 'div' | 'p')}
            >
              <FormControlLabel
                control={<Radio disabled={state.translation.locked} />}
                label={t('LWC.desktop.project.div_alignment')}
                value="div"
              />
              <FormControlLabel
                control={<Radio disabled={state.translation.locked} />}
                label={t('LWC.desktop.project.paragraph_alignment')}
                value="p"
              />
            </RadioGroup>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {t('LWC.desktop.project.languages')}
            </Typography>

            {languages.map((lang) => (
              <Stack alignItems="center" direction="row" key={lang.code} spacing={1}>
                <TextField disabled label={t('LWC.desktop.project.code')} size="small" sx={{ flex: 1 }} value={lang.code} />
                <TextField
                  disabled
                  label={t('LWC.desktop.project.label')}
                  size="small"
                  sx={{ flex: 2 }}
                  value={lang.label}
                />
                <IconButton aria-label={t('LWC.desktop.project.remove_language')} onClick={() => removeLanguage(lang.code)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            ))}

            <Stack alignItems="center" direction="row" spacing={1}>
              <TextField
                label={t('LWC.desktop.project.add_translation_language')}
                InputLabelProps={{ shrink: true }}
                onChange={(event) => setNewLangCode(event.target.value)}
                select
                size="small"
                SelectProps={{ native: true }}
                sx={{ flex: 2 }}
                value={newLangCode}
              >
                <option value="" />
                {FIXED_LANGUAGE_OPTIONS.filter(
                  (option) => !languages.some((lang) => lang.code === option.code),
                ).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} ({option.code})
                  </option>
                ))}
              </TextField>
              <Button disabled={!newLangCode} onClick={addLanguage} size="small" variant="text">
                {t('LWC.commons.add')}
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
            {t('LWC.commons.cancel')}
          </Button>
        )}
        {!isFirstSetup && (
          <Button
            disabled={submitting || languageMissing}
            onClick={() => void handleSave(false)}
            variant="outlined"
          >
            {t('LWC.desktop.project.save_defaults_only')}
          </Button>
        )}
        <Button
          color="primary"
          disabled={submitting || !state || languageMissing}
          onClick={() => void handleSave(!isFirstSetup)}
          variant="contained"
        >
          {isFirstSetup ? t('LWC.desktop.project.save_button') : t('LWC.desktop.project.save_and_update_documents_button')}
        </Button>
      </Box>
    </Box>
  );
};
