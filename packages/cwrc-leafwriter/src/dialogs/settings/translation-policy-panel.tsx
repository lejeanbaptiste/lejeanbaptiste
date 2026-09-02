import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FIELD_OPTIONS,
  LANGUAGE_PRESETS,
  loadDateFormatState,
  saveDateFormatState,
  type DateFormatLanguage,
  type DateFormatSettings,
  type EraDisplay,
  type BracketsPolicy,
  type StoredDateFormatState,
  type TitleConvention,
  type YearNumbering,
} from '../../layout/entityFields/dateFormatSettings';

const CUSTOM = '__custom__';

const FIELD_KEYS: { key: keyof DateFormatSettings; labelKey: string }[] = [
  { key: 'birthWord', labelKey: 'LW.settings.translationPolicy.birth' },
  { key: 'deathWord', labelKey: 'LW.settings.translationPolicy.death' },
  { key: 'floruitWord', labelKey: 'LW.settings.translationPolicy.floruit' },
  { key: 'activeWord', labelKey: 'LW.settings.translationPolicy.active' },
  { key: 'activeToWord', labelKey: 'LW.settings.translationPolicy.activeTo' },
  { key: 'circaWord', labelKey: 'LW.settings.translationPolicy.circa' },
  { key: 'ceLabel', labelKey: 'LW.settings.translationPolicy.ceLabel' },
  { key: 'bceLabel', labelKey: 'LW.settings.translationPolicy.bceLabel' },
];

const PresetField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[] | undefined;
  onChange: (value: string) => void;
}) => {
  const { t } = useTranslation();
  const [customMode, setCustomMode] = useState(!options?.includes(value));

  useEffect(() => {
    setCustomMode(!options?.includes(value));
  }, [options, value]);

  if (!options) {
    return (
      <TextField
        fullWidth
        label={label}
        onChange={(event) => onChange(event.target.value)}
        size="small"
        value={value}
      />
    );
  }

  return (
    <Stack spacing={0.75}>
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
          label={label}
          onChange={(event) => {
            const next = String(event.target.value);
            if (next === CUSTOM) {
              setCustomMode(true);
            } else {
              setCustomMode(false);
              onChange(next);
            }
          }}
          value={customMode ? CUSTOM : value}
        >
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM}>{t('LW.settings.translationPolicy.custom')}</MenuItem>
        </Select>
      </FormControl>
      {customMode ? (
        <TextField
          fullWidth
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('LW.settings.translationPolicy.customPlaceholder')}
          size="small"
          value={value}
        />
      ) : null}
    </Stack>
  );
};

export const TranslationPolicyPanel = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<StoredDateFormatState>(() => loadDateFormatState());
  const [language, setLanguage] = useState<DateFormatLanguage>('en');
  const [draft, setDraft] = useState<DateFormatSettings>(() => loadDateFormatState().byLanguage.en);
  const [savedFlash, setSavedFlash] = useState(false);

  const selectLanguage = (next: DateFormatLanguage) => {
    setLanguage(next);
    setDraft(state.byLanguage[next]);
  };

  const handleSave = () => {
    const next: StoredDateFormatState = {
      byLanguage: {
        ...state.byLanguage,
        [language]: draft,
      },
    };
    saveDateFormatState(next);
    setState(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const resetToPreset = () => setDraft({ ...LANGUAGE_PRESETS[language] });

  const languageLabel = (code: DateFormatLanguage): string => {
    switch (code) {
      case 'en':
        return t('LW.settings.translationPolicy.langEn');
      case 'fr':
        return t('LW.settings.translationPolicy.langFr');
      case 'de':
        return t('LW.settings.translationPolicy.langDe');
      case 'zh':
        return t('LW.settings.translationPolicy.langZh');
      case 'ja':
        return t('LW.settings.translationPolicy.langJa');
      case 'ko':
        return t('LW.settings.translationPolicy.langKo');
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography color="text.secondary" variant="body2">
        {t('LW.settings.translationPolicy.intro')}
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel>{t('LW.settings.translationPolicy.language')}</InputLabel>
        <Select
          label={t('LW.settings.translationPolicy.language')}
          onChange={(event) => selectLanguage(event.target.value as DateFormatLanguage)}
          value={language}
        >
          {(Object.keys(LANGUAGE_PRESETS) as DateFormatLanguage[]).map((code) => (
            <MenuItem key={code} value={code}>
              {languageLabel(code)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Button onClick={resetToPreset} size="small">
          {t('LW.settings.translationPolicy.resetDefaults', { language: languageLabel(language) })}
        </Button>
      </Box>

      <FormControl fullWidth size="small">
        <InputLabel>{t('LW.settings.translationPolicy.titleConvention')}</InputLabel>
        <Select
          label={t('LW.settings.translationPolicy.titleConvention')}
          onChange={(event) =>
            setDraft({
              ...draft,
              titleConvention: event.target.value as TitleConvention,
            })
          }
          value={draft.titleConvention}
        >
          <MenuItem value="romanization-first">
            {t('LW.settings.translationPolicy.titleConventionRomanizationFirst')}
          </MenuItem>
          <MenuItem value="translation-first">
            {t('LW.settings.translationPolicy.titleConventionTranslationFirst')}
          </MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>{t('LW.settings.translationPolicy.bracketsPolicy')}</InputLabel>
        <Select
          label={t('LW.settings.translationPolicy.bracketsPolicy')}
          onChange={(event) =>
            setDraft({
              ...draft,
              bracketsPolicy: event.target.value as BracketsPolicy,
            })
          }
          value={draft.bracketsPolicy}
        >
          <MenuItem value="never">{t('LW.settings.translationPolicy.bracketsNever')}</MenuItem>
          <MenuItem value="first-mention-only">
            {t('LW.settings.translationPolicy.bracketsFirstMention')}
          </MenuItem>
          <MenuItem value="always">{t('LW.settings.translationPolicy.bracketsAlways')}</MenuItem>
        </Select>
      </FormControl>

      <Stack spacing={1.25}>
        {FIELD_KEYS.map(({ key, labelKey }) => (
          <PresetField
            key={`${language}-${key}`}
            label={t(labelKey)}
            onChange={(value) => setDraft({ ...draft, [key]: value })}
            options={FIELD_OPTIONS[language]?.[key]}
            value={String(draft[key])}
          />
        ))}
      </Stack>

      <FormControl fullWidth size="small">
        <InputLabel>{t('LW.settings.translationPolicy.eraDisplay')}</InputLabel>
        <Select
          label={t('LW.settings.translationPolicy.eraDisplay')}
          onChange={(event) => setDraft({ ...draft, eraDisplay: event.target.value as EraDisplay })}
          value={draft.eraDisplay}
        >
          <MenuItem value="none">{t('LW.settings.translationPolicy.eraNever')}</MenuItem>
          <MenuItem value="bce_only">{t('LW.settings.translationPolicy.eraBceOnly')}</MenuItem>
          <MenuItem value="always">{t('LW.settings.translationPolicy.eraAlways')}</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>{t('LW.settings.translationPolicy.yearNumbering')}</InputLabel>
        <Select
          label={t('LW.settings.translationPolicy.yearNumbering')}
          onChange={(event) =>
            setDraft({ ...draft, yearNumbering: event.target.value as YearNumbering })
          }
          value={draft.yearNumbering}
        >
          <MenuItem value="astronomical">
            {t('LW.settings.translationPolicy.yearAstronomical')}
          </MenuItem>
          <MenuItem value="historical">
            {t('LW.settings.translationPolicy.yearHistorical')}
          </MenuItem>
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
