import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleButtonGroup } from '../components/ToggleButtonGroup';
import {
  defaultPolicyForLanguage,
  validateCustomNameTypeId,
  type CustomNameType,
  type NameTypeTaggingBucket,
} from './authoritySettings';
import { ALL_NAME_TYPES, type NameTypeId } from './nameTypes';
import { nameTypeLabel } from './nameTypeLabels';

const BUCKET_VALUES: NameTypeTaggingBucket[] = ['phase1', 'phase2', 'never'];

function builtInBucketsFromPolicy(
  buckets: Record<string, NameTypeTaggingBucket>,
): Record<NameTypeId, NameTypeTaggingBucket> {
  return Object.fromEntries(
    ALL_NAME_TYPES.map((type) => [type, buckets[type] ?? 'phase1']),
  ) as Record<NameTypeId, NameTypeTaggingBucket>;
}

const BucketSelector = ({
  value,
  onChange,
  ariaLabel,
  labels,
}: {
  value: NameTypeTaggingBucket;
  onChange: (bucket: NameTypeTaggingBucket) => void;
  ariaLabel: string;
  labels: Record<NameTypeTaggingBucket, string>;
}) => (
  <ToggleButtonGroup
    exclusive
    size="small"
    value={value}
    onChange={(_event, next: NameTypeTaggingBucket | null) => {
      if (next) onChange(next);
    }}
    aria-label={ariaLabel}
  >
    {BUCKET_VALUES.map((bucket) => (
      <ToggleButton key={bucket} value={bucket} sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>
        {labels[bucket]}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

/** Load/save contract so the panel can run in the project-settings dialog window. */
export type NameTypePolicyIO = {
  load: () => Promise<{
    buckets: Record<string, NameTypeTaggingBucket>;
    customTypes: CustomNameType[];
    artMinCodePoints: number;
    sourceLanguage: string | null;
  }>;
  persist: (next: {
    buckets: Record<NameTypeId, NameTypeTaggingBucket>;
    customTypes: CustomNameType[];
    artMinCodePoints: number;
  }) => Promise<void>;
};

export const NameTypePolicyPanel = ({
  io,
  sourceLanguage: sourceLanguageOverride,
}: {
  io: NameTypePolicyIO;
  /** Draft language from the open project-settings form (overrides loaded language for labels/reset). */
  sourceLanguage?: string | null;
}) => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [loadedSourceLanguage, setLoadedSourceLanguage] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<Record<NameTypeId, NameTypeTaggingBucket>>(
    () => builtInBucketsFromPolicy(defaultPolicyForLanguage(null)),
  );
  const [customTypes, setCustomTypes] = useState<CustomNameType[]>([]);
  const [artMinCodePoints, setArtMinCodePoints] = useState(3);
  const [newCustomId, setNewCustomId] = useState('');
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomBucket, setNewCustomBucket] = useState<NameTypeTaggingBucket>('phase2');
  const [customFormError, setCustomFormError] = useState<string | null>(null);
  const saveGenerationRef = useRef(0);

  const sourceLanguage =
    sourceLanguageOverride !== undefined ? sourceLanguageOverride : loadedSourceLanguage;

  const bucketLabels: Record<NameTypeTaggingBucket, string> = {
    phase1: t('LW.nameTypePolicy.phase1'),
    phase2: t('LW.nameTypePolicy.phase2'),
    never: t('LW.nameTypePolicy.never'),
  };

  const persist = useCallback(
    async (next: {
      buckets: Record<NameTypeId, NameTypeTaggingBucket>;
      customTypes: CustomNameType[];
      artMinCodePoints: number;
    }) => {
      const generation = ++saveGenerationRef.current;
      await io.persist(next);
      if (generation !== saveGenerationRef.current) return;
    },
    [io],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const policy = await io.load();
      if (cancelled) return;
      setBuckets(builtInBucketsFromPolicy(policy.buckets));
      setCustomTypes(policy.customTypes);
      setArtMinCodePoints(policy.artMinCodePoints);
      setLoadedSourceLanguage(policy.sourceLanguage);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [io]);

  const updateBuiltInBucket = (type: NameTypeId, bucket: NameTypeTaggingBucket) => {
    setBuckets((current) => {
      const next = { ...current, [type]: bucket };
      void persist({ buckets: next, customTypes, artMinCodePoints });
      return next;
    });
  };

  const updateCustomBucket = (id: string, bucket: NameTypeTaggingBucket) => {
    setCustomTypes((current) => {
      const next = current.map((entry) => (entry.id === id ? { ...entry, bucket } : entry));
      void persist({ buckets, customTypes: next, artMinCodePoints });
      return next;
    });
  };

  const deleteCustomType = (id: string) => {
    setCustomTypes((current) => {
      const next = current.filter((entry) => entry.id !== id);
      void persist({ buckets, customTypes: next, artMinCodePoints });
      return next;
    });
  };

  const handleResetToPreset = () => {
    const preset = defaultPolicyForLanguage(sourceLanguage);
    const nextBuckets = builtInBucketsFromPolicy(preset);
    setBuckets(nextBuckets);
    void persist({ buckets: nextBuckets, customTypes, artMinCodePoints });
  };

  const handleAddCustomType = () => {
    const id = newCustomId.trim();
    const label = newCustomLabel.trim();
    const idError = validateCustomNameTypeId(id);
    if (idError === 'invalid_slug') {
      setCustomFormError(t('LW.nameTypePolicy.errors.invalid_slug'));
      return;
    }
    if (idError === 'shadows_builtin') {
      setCustomFormError(t('LW.nameTypePolicy.errors.shadows_builtin', { id }));
      return;
    }
    if (!label) {
      setCustomFormError(t('LW.nameTypePolicy.errors.label_required'));
      return;
    }
    if (customTypes.some((entry) => entry.id === id)) {
      setCustomFormError(t('LW.nameTypePolicy.errors.id_exists', { id }));
      return;
    }
    const entry: CustomNameType = { id, label, bucket: newCustomBucket };
    const next = [...customTypes, entry];
    setCustomTypes(next);
    setNewCustomId('');
    setNewCustomLabel('');
    setNewCustomBucket('phase2');
    setCustomFormError(null);
    void persist({ buckets, customTypes: next, artMinCodePoints });
  };

  if (!loaded) return null;

  const primaryBucket = buckets.primary;
  const showPrimaryWarning = primaryBucket === 'phase2' || primaryBucket === 'never';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <Stack spacing={1.25} width="100%">
        <Box>
          <Typography variant="subtitle2">{t('LW.nameTypePolicy.title')}</Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
            {t('LW.nameTypePolicy.intro')}
          </Typography>
        </Box>

        {showPrimaryWarning && (
          <Alert severity="warning" sx={{ py: 0.25 }}>
            {t('LW.nameTypePolicy.primary_warning')}
          </Alert>
        )}

        {ALL_NAME_TYPES.map((type) => {
          const typeLabel = nameTypeLabel(type, sourceLanguage);
          return (
            <Stack
              key={type}
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              gap={1}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2">{typeLabel}</Typography>
                {type === 'art' && buckets.art !== 'never' && (
                  <Typography variant="caption" color="text.secondary" component="p">
                    {t('LW.nameTypePolicy.art_length_hint', { count: artMinCodePoints })}
                  </Typography>
                )}
              </Box>
              <BucketSelector
                value={buckets[type]}
                onChange={(bucket) => updateBuiltInBucket(type, bucket)}
                ariaLabel={t('LW.nameTypePolicy.bucket_aria', { label: typeLabel })}
                labels={bucketLabels}
              />
            </Stack>
          );
        })}

        <Button size="small" variant="text" sx={{ alignSelf: 'flex-start' }} onClick={handleResetToPreset}>
          {t('LW.nameTypePolicy.reset_preset')}
        </Button>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {t('LW.nameTypePolicy.custom_title')}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            {t('LW.nameTypePolicy.custom_intro')}
          </Typography>

          {customTypes.length > 0 && (
            <Stack spacing={1} sx={{ mb: 1 }}>
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
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <BucketSelector
                      value={entry.bucket}
                      onChange={(bucket) => updateCustomBucket(entry.id, bucket)}
                      ariaLabel={t('LW.nameTypePolicy.bucket_aria', { label: entry.label })}
                      labels={bucketLabels}
                    />
                    <IconButton
                      size="small"
                      aria-label={t('LW.nameTypePolicy.remove_custom', { label: entry.label })}
                      onClick={() => deleteCustomType(entry.id)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}

          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label={t('LW.nameTypePolicy.id_label')}
                placeholder={t('LW.nameTypePolicy.id_placeholder')}
                value={newCustomId}
                onChange={(event) => {
                  setNewCustomId(event.target.value);
                  setCustomFormError(null);
                }}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label={t('LW.nameTypePolicy.label_label')}
                placeholder={t('LW.nameTypePolicy.label_placeholder')}
                value={newCustomLabel}
                onChange={(event) => {
                  setNewCustomLabel(event.target.value);
                  setCustomFormError(null);
                }}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <BucketSelector
                value={newCustomBucket}
                onChange={setNewCustomBucket}
                ariaLabel={t('LW.nameTypePolicy.new_custom_bucket_aria')}
                labels={bucketLabels}
              />
              <Button size="small" variant="outlined" onClick={handleAddCustomType}>
                {t('LW.nameTypePolicy.add_custom')}
              </Button>
            </Stack>
            {customFormError && (
              <Typography variant="caption" color="error">
                {customFormError}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};
