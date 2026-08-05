import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Popover,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { dateFormatSettingsForLang } from './dateFormatSettings';
import {
  chineseNameOf,
  familyAndGivenOf,
  formatDates,
  possessiveStyleForLang,
  renderEntityFromSpec,
  type EntityDisplaySpec,
  type EntityPartId,
} from './entityDisplay';
import type { EntitySummary } from './entitySummary';

const PART_ORDER: EntityPartId[] = ['family', 'given', 'chinese', 'dates'];

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
}

const partLabel = (id: EntityPartId, entity: EntitySummary, lang?: string | null): string => {
  const { family, given } = familyAndGivenOf(entity);
  switch (id) {
    case 'family':
      return family ?? '—';
    case 'given':
      return given ?? '—';
    case 'chinese':
      return chineseNameOf(entity) ?? '—';
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
    case 'chinese':
      return 'LW.translationPane.entityFormat.chinese';
    case 'dates':
      return 'LW.translationPane.entityFormat.dates';
  }
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
}: EntityDisplayPopupProps) => {
  const { t } = useTranslation();
  const dateSettings = dateFormatSettingsForLang(lang);
  const preview = renderEntityFromSpec(entity, occurrenceIndex, spec, dateSettings, lang);
  const hidden = new Set(spec.hidden);
  const possessiveStyle = possessiveStyleForLang(lang);
  const showPossessive = possessiveStyle !== 'none';

  const toggleHidden = (id: EntityPartId) => {
    const nextHidden = hidden.has(id)
      ? spec.hidden.filter((part) => part !== id)
      : [...spec.hidden, id];
    onChange({ ...spec, hidden: nextHidden });
  };

  const toggleBrackets = (id: EntityPartId) => {
    onChange({
      ...spec,
      bracketsAround: spec.bracketsAround === id ? null : id,
    });
  };

  const possessiveLabel =
    possessiveStyle === 'de-genitive-s'
      ? t('LW.translationPane.entityFormat.possessiveGerman')
      : t('LW.translationPane.entityFormat.possessive');

  return (
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
          {PART_ORDER.map((id) => {
            const label = partLabel(id, entity, lang);
            const available = label !== '—';
            const isHidden = hidden.has(id);
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
                  '& .MuiChip-deleteIcon': { color: hasBrackets ? 'primary.contrastText' : 'inherit' },
                }}
              />
            );
          })}
        </Stack>

        <Typography color="text.secondary" variant="caption">
          {t('LW.translationPane.entityFormat.chipHint')}
        </Typography>

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
  );
};
