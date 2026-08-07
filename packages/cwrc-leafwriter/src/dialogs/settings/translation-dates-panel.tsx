import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DATE_MONTH_SPAN_STYLES,
  DATE_WESTERN_DISPLAY_MODES,
  type DateMonthSpanStyle,
  type DateWesternDisplayMode,
} from '../../layout/entityFields/dateGloss';
import {
  loadScholarlyConventions,
  saveScholarlyConventions,
  type ScholarlyConventions,
} from '../../layout/entityFields/scholarlyConventions';

const MODE_I18N: Record<
  DateWesternDisplayMode,
  { label: string; example: string }
> = {
  'translation+western': {
    label: 'LW.settings.translationPolicy.modeTranslationWestern',
    example: 'LW.settings.translationPolicy.exampleTranslationWestern',
  },
  translation: {
    label: 'LW.settings.translationPolicy.modeTranslation',
    example: 'LW.settings.translationPolicy.exampleTranslation',
  },
  western: {
    label: 'LW.settings.translationPolicy.modeWestern',
    example: 'LW.settings.translationPolicy.exampleWestern',
  },
};

const SPAN_I18N: Record<DateMonthSpanStyle, { label: string; example: string }> = {
  months: {
    label: 'LW.settings.translationPolicy.spanMonths',
    example: 'LW.settings.translationPolicy.exampleSpanMonths',
  },
  full: {
    label: 'LW.settings.translationPolicy.spanFull',
    example: 'LW.settings.translationPolicy.exampleSpanFull',
  },
};

/** Sanmiao / LJBtero calendar-date display — lives under Translation policy → Dates. */
export const TranslationDatesPanel = () => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ScholarlyConventions>(() => loadScholarlyConventions());
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSave = () => {
    saveScholarlyConventions(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const conversionOn = draft.dateWesternDisplay !== 'translation';

  return (
    <Stack spacing={1.5}>
      <Typography color="text.secondary" variant="body2">
        {t('LW.settings.translationPolicy.datesIntro')}
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel>{t('LW.settings.translationPolicy.dateWesternDisplay')}</InputLabel>
        <Select
          label={t('LW.settings.translationPolicy.dateWesternDisplay')}
          onChange={(event) =>
            setDraft({
              ...draft,
              dateWesternDisplay: event.target.value as DateWesternDisplayMode,
            })
          }
          renderValue={(value) => t(MODE_I18N[value as DateWesternDisplayMode].label)}
          value={draft.dateWesternDisplay}
        >
          {DATE_WESTERN_DISPLAY_MODES.map((mode) => (
            <MenuItem key={mode} value={mode}>
              <Stack spacing={0.15}>
                <Typography variant="body2">{t(MODE_I18N[mode].label)}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {t(MODE_I18N[mode].example)}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography color="text.secondary" variant="caption">
        {t('LW.settings.translationPolicy.unresolvedNote')}
      </Typography>

      <FormControl disabled={!conversionOn} fullWidth size="small">
        <InputLabel>{t('LW.settings.translationPolicy.dateMonthSpanStyle')}</InputLabel>
        <Select
          label={t('LW.settings.translationPolicy.dateMonthSpanStyle')}
          onChange={(event) =>
            setDraft({
              ...draft,
              dateMonthSpanStyle: event.target.value as DateMonthSpanStyle,
            })
          }
          renderValue={(value) => t(SPAN_I18N[value as DateMonthSpanStyle].label)}
          value={draft.dateMonthSpanStyle}
        >
          {DATE_MONTH_SPAN_STYLES.map((style) => (
            <MenuItem key={style} value={style}>
              <Stack spacing={0.15}>
                <Typography variant="body2">{t(SPAN_I18N[style].label)}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {t(SPAN_I18N[style].example)}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Stack alignItems="center" direction="row" spacing={1}>
        <Button onClick={handleSave} size="small" variant="contained">
          {t('LW.settings.translationPolicy.save')}
        </Button>
        {savedFlash ? (
          <Typography color="success.main" variant="caption">
            {t('LW.settings.translationPolicy.saved')}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
};
