import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Popover,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dateFormatSettingsForLang } from './dateFormatSettings';
import {
  chineseNameOf,
  effectiveTitleConvention,
  entityKindSupportsVernacularGloss,
  familyAndGivenOf,
  formatDates,
  isEntityPartShown,
  possessiveStyleForLang,
  renderEntityFromSpec,
  shortFormOptionalParts,
  shortNameOf,
  translatedNameOf,
  type EntityDisplaySpec,
  type EntityPartId,
} from './entityDisplay';
import type { EntitySummary } from './entitySummary';
import { languageLabelForCode } from '../../utilities/languageCodes';

const PERSON_ROMANIZATION_FIRST: EntityPartId[] = [
  'family',
  'given',
  'chinese',
  'translation',
  'dates',
];
const PERSON_TRANSLATION_FIRST: EntityPartId[] = ['translation', 'original', 'dates'];
const WORK_ROMANIZATION_FIRST: EntityPartId[] = ['name', 'chinese', 'translation', 'dates'];
const WORK_TRANSLATION_FIRST: EntityPartId[] = ['translation', 'original', 'dates'];
const OTHER_ROMANIZATION_FIRST: EntityPartId[] = [
  'name',
  'classification',
  'chinese',
  'translation',
];
const OTHER_TRANSLATION_FIRST: EntityPartId[] = ['translation', 'original', 'classification'];
/** Offices with a gloss: vernacular lead; pinyin / characters available as extras. */
const OFFICE_TRANSLATION_ONLY: EntityPartId[] = [
  'translation',
  'name',
  'chinese',
  'original',
  'classification',
];

/** Dates only make sense for person (birth/death) and work (publication/composition). */
const partOrderFor = (
  entity: EntitySummary,
  convention: 'romanization-first' | 'translation-first',
): EntityPartId[] => {
  if (entity.kind === 'person') {
    return convention === 'translation-first'
      ? PERSON_TRANSLATION_FIRST
      : PERSON_ROMANIZATION_FIRST;
  }
  if (entity.kind === 'work') {
    return convention === 'translation-first' ? WORK_TRANSLATION_FIRST : WORK_ROMANIZATION_FIRST;
  }
  if (entity.kind === 'office' && convention === 'translation-first') {
    return OFFICE_TRANSLATION_ONLY;
  }
  return convention === 'translation-first' ? OTHER_TRANSLATION_FIRST : OTHER_ROMANIZATION_FIRST;
};

export interface EntityDisplayPopupProps {
  anchorPosition: { top: number; left: number } | null;
  entity: EntitySummary;
  /** Target translation language (drives possessive style and date policy). */
  lang?: string | null;
  /** 1-based occurrence of this field in the current unit (for live preview). */
  occurrenceIndex: number;
  open: boolean;
  spec: EntityDisplaySpec;
  onChange: (spec: EntityDisplaySpec) => void;
  onClose: () => void;
  onReset: () => void;
  /** Persist a vernacular gloss for the pane language; returns false on failure. */
  onSaveTranslation?: (text: string, lang: string) => Promise<boolean>;
  /**
   * Fill the draft gloss via AI for the pane language.
   * Returns the suggested text, or null on failure / cancel.
   */
  onSuggestTranslation?: () => Promise<string | null>;
  /** True while a suggest request is in flight (disables the button). */
  suggestBusy?: boolean;
}

const partLabel = (id: EntityPartId, entity: EntitySummary, lang?: string | null): string => {
  switch (id) {
    case 'family':
      return familyAndGivenOf(entity).family ?? '—';
    case 'given':
      return familyAndGivenOf(entity).given ?? '—';
    case 'name':
      return shortNameOf(entity) ?? '—';
    case 'classification':
      return entity.classification ?? '—';
    case 'chinese':
      return chineseNameOf(entity) ?? '—';
    case 'original': {
      const short = shortNameOf(entity);
      const chinese = chineseNameOf(entity);
      if (chinese && chinese !== short) return `(${short} ${chinese})`;
      return short ? `(${short})` : '—';
    }
    case 'translation': {
      const gloss = translatedNameOf(entity, lang);
      // Lead gloss (translation-first / office default) is not parenthesized in text.
      if (entity.kind === 'office' && gloss) return gloss;
      return gloss ? `(${gloss})` : '—';
    }
    case 'dates': {
      const dates = formatDates(entity.dates, dateFormatSettingsForLang(lang));
      return dates ? `(${dates})` : '—';
    }
  }
};

const partTitleKey = (id: EntityPartId): string => {
  switch (id) {
    case 'family':
      return 'LW.translationPane.entityFormat.family';
    case 'given':
      return 'LW.translationPane.entityFormat.given';
    case 'name':
      return 'LW.translationPane.entityFormat.name';
    case 'classification':
      return 'LW.translationPane.entityFormat.classification';
    case 'chinese':
      return 'LW.translationPane.entityFormat.chinese';
    case 'original':
      return 'LW.translationPane.entityFormat.original';
    case 'translation':
      return 'LW.translationPane.entityFormat.translation';
    case 'dates':
      return 'LW.translationPane.entityFormat.dates';
  }
};

const dashedChipSx = {
  borderStyle: 'dashed',
  borderColor: 'warning.main',
  color: 'text.secondary',
  bgcolor: 'transparent',
  '&:hover': { bgcolor: 'action.hover', borderStyle: 'dashed' },
};

export const EntityDisplayPopup = ({
  anchorPosition,
  entity,
  lang,
  occurrenceIndex,
  open,
  spec,
  onChange,
  onClose,
  onReset,
  onSaveTranslation,
  onSuggestTranslation,
  suggestBusy = false,
}: EntityDisplayPopupProps) => {
  const { t } = useTranslation();
  const dateSettings = dateFormatSettingsForLang(lang);
  const preview = renderEntityFromSpec(entity, occurrenceIndex, spec, dateSettings, lang);
  const possessiveStyle = possessiveStyleForLang(lang);
  const showPossessive = possessiveStyle !== 'none';
  const gloss = translatedNameOf(entity, lang);
  const hasGloss = Boolean(gloss);
  const supportsVernacularGloss = entityKindSupportsVernacularGloss(entity.kind);
  const convention = hasGloss
    ? effectiveTitleConvention(spec, lang, entity.kind)
    : 'romanization-first';
  const leadWithTranslation = convention === 'translation-first';
  const officeTranslationOnly =
    entity.kind === 'office' && hasGloss && spec.titleConvention !== 'romanization-first';
  const langLabel = lang ? languageLabelForCode(lang) : '';
  const canAddTranslation = supportsVernacularGloss && Boolean(lang) && Boolean(onSaveTranslation);
  const canSuggestTranslation = supportsVernacularGloss && Boolean(onSuggestTranslation);

  const [addOpen, setAddOpen] = useState(false);
  const [draftTranslation, setDraftTranslation] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const toggleHidden = (id: EntityPartId) => {
    const shown = isEntityPartShown(entity, occurrenceIndex, spec, id, lang);
    // Optional short-form parts (and office translation-only extras on first
    // mention) toggle via extraParts rather than hidden.
    const optional = shortFormOptionalParts(entity, lang);
    if (optional.includes(id) && (occurrenceIndex > 1 || officeTranslationOnly)) {
      const extras = new Set(spec.extraParts ?? []);
      if (shown) extras.delete(id);
      else extras.add(id);
      onChange({
        ...spec,
        extraParts: [...extras],
        // Keep in sync if it was previously forced into hidden.
        hidden: spec.hidden.filter((part) => part !== id),
      });
      return;
    }
    const nextHidden = shown
      ? [...spec.hidden, id]
      : spec.hidden.filter((part) => part !== id);
    onChange({ ...spec, hidden: [...new Set(nextHidden)] });
  };

  const toggleBrackets = (id: EntityPartId) => {
    onChange({
      ...spec,
      bracketsAround: spec.bracketsAround === id ? null : id,
    });
  };

  const setLeadWithTranslation = (checked: boolean) => {
    onChange({
      ...spec,
      titleConvention: checked ? 'translation-first' : 'romanization-first',
    });
  };

  const openAddDialog = () => {
    setDraftTranslation('');
    setSaveError(null);
    setSuggestError(null);
    setAddOpen(true);
  };

  const closeAddDialog = () => {
    if (saving || suggesting || suggestBusy) return;
    setAddOpen(false);
    setDraftTranslation('');
    setSaveError(null);
    setSuggestError(null);
  };

  const saveTranslation = async () => {
    const text = draftTranslation.trim();
    if (!text || !lang || !onSaveTranslation) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ok = await onSaveTranslation(text, lang);
      if (!ok) {
        setSaveError(t('LW.translationPane.entityFormat.addTranslationError'));
        return;
      }
      setAddOpen(false);
      setDraftTranslation('');
      setSuggestError(null);
    } catch {
      setSaveError(t('LW.translationPane.entityFormat.addTranslationError'));
    } finally {
      setSaving(false);
    }
  };

  const suggestTranslation = async () => {
    if (!onSuggestTranslation || suggesting || suggestBusy || saving) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const glossText = await onSuggestTranslation();
      if (glossText == null) {
        setSuggestError(t('LW.translationPane.entityFormat.suggestTranslationError'));
        return;
      }
      setDraftTranslation(glossText);
    } catch {
      setSuggestError(t('LW.translationPane.entityFormat.suggestTranslationError'));
    } finally {
      setSuggesting(false);
    }
  };

  const suggestInFlight = suggesting || suggestBusy;

  const possessiveLabel =
    possessiveStyle === 'de-genitive-s'
      ? t('LW.translationPane.entityFormat.possessiveGerman')
      : t('LW.translationPane.entityFormat.possessive');

  const chipIds = partOrderFor(entity, convention).filter((id) => {
    // Missing gloss: hide the blank Translation chip; show dashed nudge instead.
    if (id === 'translation' && !hasGloss) return false;
    return true;
  });

  return (
    <>
      <Popover
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
        onClose={onClose}
        open={open && Boolean(anchorPosition)}
        slotProps={{
          paper: {
            sx: { p: 1.5, maxWidth: 360 },
          },
        }}
      >
        <Stack spacing={1.25}>
          <Typography variant="subtitle2">{t('LW.translationPane.entityFormat.title')}</Typography>

          <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
            {chipIds.map((id) => {
              const label = partLabel(id, entity, lang);
              const available = label !== '—';
              const isHidden = !isEntityPartShown(entity, occurrenceIndex, spec, id, lang);
              const hasBrackets = spec.bracketsAround === id;
              return (
                <Chip
                  key={id}
                  color={isHidden ? 'default' : 'primary'}
                  disabled={!available}
                  label={
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{t(partTitleKey(id))}</span>
                      <Box
                        component="span"
                        sx={{ opacity: 0.75, fontWeight: 400, textTransform: 'none' }}
                      >
                        {label}
                      </Box>
                      {hasBrackets ? <span>[ ]</span> : null}
                    </Box>
                  }
                  onClick={() => available && toggleHidden(id)}
                  onDelete={available ? () => toggleBrackets(id) : undefined}
                  deleteIcon={
                    <Box
                      aria-label={t('LW.translationPane.entityFormat.brackets')}
                      component="span"
                      sx={{ px: 0.5, fontSize: '0.75rem', lineHeight: 1 }}
                      title={t('LW.translationPane.entityFormat.brackets')}
                    >
                      [ ]
                    </Box>
                  }
                  size="small"
                  variant={isHidden ? 'outlined' : 'filled'}
                  sx={{
                    opacity: isHidden ? 0.55 : 1,
                    textDecoration: isHidden ? 'line-through' : 'none',
                    '& .MuiChip-deleteIcon': {
                      color: hasBrackets ? 'primary.contrastText' : 'inherit',
                    },
                  }}
                />
              );
            })}
            {!hasGloss && canAddTranslation ? (
              <Chip
                clickable
                label={t('LW.translationPane.entityFormat.addTranslation')}
                onClick={openAddDialog}
                size="small"
                variant="outlined"
                sx={dashedChipSx}
              />
            ) : null}
          </Stack>

          <Typography color="text.secondary" variant="caption">
            {t('LW.translationPane.entityFormat.chipHint')}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={leadWithTranslation}
                disabled={!hasGloss}
                onChange={(event) => setLeadWithTranslation(event.target.checked)}
                size="small"
              />
            }
            label={t('LW.translationPane.entityFormat.leadWithTranslation')}
          />

          {showPossessive ? (
            <FormControlLabel
              control={
                <Switch
                  checked={spec.possessive}
                  onChange={(event) => onChange({ ...spec, possessive: event.target.checked })}
                  size="small"
                />
              }
              label={possessiveLabel}
            />
          ) : null}

          <Box
            sx={{
              bgcolor: 'action.hover',
              borderRadius: 1,
              px: 1,
              py: 0.75,
            }}
          >
            <Typography color="text.secondary" variant="caption">
              {t('LW.translationPane.entityFormat.preview')}
            </Typography>
            <Typography variant="body2">{preview || '—'}</Typography>
          </Box>

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={onReset} size="small">
              {t('LW.translationPane.entityFormat.reset')}
            </Button>
            <Button onClick={onClose} size="small" variant="contained">
              {t('LW.translationPane.entityFormat.done')}
            </Button>
          </Stack>
        </Stack>
      </Popover>

      <Dialog open={addOpen} onClose={closeAddDialog} fullWidth maxWidth="xs">
        <DialogTitle>{t('LW.translationPane.entityFormat.addTranslationTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('LW.translationPane.entityFormat.addTranslationPrompt', {
              language: langLabel || lang || '',
            })}
            margin="dense"
            onChange={(event) => setDraftTranslation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void saveTranslation();
              }
            }}
            value={draftTranslation}
          />
          {saveError ? (
            <Typography color="error" sx={{ mt: 1 }} variant="caption">
              {saveError}
            </Typography>
          ) : null}
          {suggestError ? (
            <Typography color="error" sx={{ mt: 1 }} variant="caption">
              {suggestError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions
          sx={{ justifyContent: canSuggestTranslation ? 'space-between' : undefined }}
        >
          {canSuggestTranslation ? (
            <Button
              disabled={saving || suggestInFlight}
              onClick={() => void suggestTranslation()}
            >
              {suggestInFlight
                ? t('LW.translationPane.entityFormat.suggestTranslationBusy')
                : t('LW.translationPane.entityFormat.suggestTranslation')}
            </Button>
          ) : (
            <span />
          )}
          <Stack direction="row" spacing={1}>
            <Button disabled={saving || suggestInFlight} onClick={closeAddDialog}>
              {t('LW.translationPane.entityFormat.addTranslationCancel')}
            </Button>
            <Button
              disabled={saving || suggestInFlight || !draftTranslation.trim()}
              onClick={() => void saveTranslation()}
              variant="contained"
            >
              {t('LW.translationPane.entityFormat.addTranslationSave')}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
};
