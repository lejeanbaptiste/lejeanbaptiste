import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateCustomThingTypeId, type CustomThingType } from './thingTypePolicy';

/** Load/save contract so the panel can run in the project-settings dialog window. */
export interface ThingTypePolicyIO {
  load: () => Promise<{ customTypes: CustomThingType[] }>;
  persist: (customTypes: CustomThingType[]) => Promise<void>;
}

export const ThingTypePolicyPanel = ({ io }: { io: ThingTypePolicyIO }) => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [customTypes, setCustomTypes] = useState<CustomThingType[]>([]);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const saveGenerationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const state = await io.load();
      if (cancelled) return;
      setCustomTypes(state.customTypes);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [io]);

  /**
   * `previous` lets a failed persist revert the optimistic UI update instead
   * of silently leaving the panel showing a value that was never actually
   * saved — without this, a persist failure looks identical to "it worked,
   * but disappeared later."
   */
  const persist = async (next: CustomThingType[], previous: CustomThingType[]) => {
    const generation = ++saveGenerationRef.current;
    try {
      await io.persist(next);
      if (generation !== saveGenerationRef.current) return;
      setPersistError(null);
    } catch (error) {
      if (generation !== saveGenerationRef.current) return;
      setCustomTypes(previous);
      setPersistError(error instanceof Error ? error.message : String(error));
    }
  };

  const deleteType = (id: string) => {
    setCustomTypes((current) => {
      const next = current.filter((entry) => entry.id !== id);
      void persist(next, current);
      return next;
    });
  };

  const handleAdd = () => {
    const id = newId.trim();
    const label = newLabel.trim();
    const idError = validateCustomThingTypeId(id);
    if (idError === 'invalid_slug') {
      setFormError(t('LW.thingTypePolicy.errors.invalid_slug'));
      return;
    }
    if (idError === 'reserved') {
      setFormError(t('LW.thingTypePolicy.errors.reserved', { id }));
      return;
    }
    if (!label) {
      setFormError(t('LW.thingTypePolicy.errors.label_required'));
      return;
    }
    if (customTypes.some((entry) => entry.id === id)) {
      setFormError(t('LW.thingTypePolicy.errors.id_exists', { id }));
      return;
    }
    const entry: CustomThingType = { id, label };
    const previous = customTypes;
    const next = [...previous, entry];
    setCustomTypes(next);
    setNewId('');
    setNewLabel('');
    setFormError(null);
    void persist(next, previous);
  };

  if (!loaded) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <Stack spacing={1.25} width="100%">
        <Box>
          <Typography variant="subtitle2">{t('LW.thingTypePolicy.title')}</Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
            {t('LW.thingTypePolicy.intro')}
          </Typography>
        </Box>

        {persistError && (
          <Typography variant="caption" color="error">
            {t('LW.thingTypePolicy.errors.persist_failed', { detail: persistError })}
          </Typography>
        )}

        {customTypes.length > 0 && (
          <Stack spacing={1}>
            {customTypes.map((entry) => (
              <Stack
                key={entry.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2">{entry.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry.id}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={t('LW.thingTypePolicy.remove', { label: entry.label })}
                  onClick={() => deleteType(entry.id)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}

        <Stack spacing={1}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              label={t('LW.thingTypePolicy.id_label')}
              placeholder={t('LW.thingTypePolicy.id_placeholder')}
              value={newId}
              onChange={(event) => {
                setNewId(event.target.value);
                setFormError(null);
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label={t('LW.thingTypePolicy.label_label')}
              placeholder={t('LW.thingTypePolicy.label_placeholder')}
              value={newLabel}
              onChange={(event) => {
                setNewLabel(event.target.value);
                setFormError(null);
              }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Stack direction="row" justifyContent="flex-end">
            <Button size="small" variant="outlined" onClick={handleAdd}>
              {t('LW.thingTypePolicy.add')}
            </Button>
          </Stack>
          {formError && (
            <Typography variant="caption" color="error">
              {formError}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};
