import FontDownloadIcon from '@mui/icons-material/FontDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Autocomplete,
  Box,
  CircularProgress,
  FormControl,
  IconButton,
  ListItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import {
  FALLBACK_ASIAN_FONT_OPTIONS,
  FALLBACK_LATIN_FONT_OPTIONS,
  type FontFamilyOption,
  getFontFamilyLabel,
  quoteFontFamily,
} from '../../../../overmind/editor/fontFamilies';

type LocalFontData = {
  family?: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
};

type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
};

const makeCurrentOption = (value: string): FontFamilyOption => ({
  label: getFontFamilyLabel(value),
  value,
});

const uniqueOptions = (options: FontFamilyOption[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

const toFontFamilyOption = (value: string): FontFamilyOption => {
  const trimmed = value.trim();
  return { label: getFontFamilyLabel(trimmed), value: trimmed };
};

const getOptionFromValue = (value: string, options: FontFamilyOption[]) =>
  options.find((option) => option.value === value) ?? makeCurrentOption(value);

const loadSystemFontOptions = async () => {
  const queryLocalFonts = (window as LocalFontWindow).queryLocalFonts;
  if (!queryLocalFonts) return [];

  const fonts = await queryLocalFonts();
  const families = new Set<string>();
  for (const font of fonts) {
    const family = font.family?.trim();
    if (family) families.add(family);
  }

  return [...families]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((family) => ({ label: family, value: quoteFontFamily(family) }));
};

export const FontFamily = () => {
  const { asianFont, latinFont } = useAppState().editor;
  const { setAsianFont, setLatinFont } = useActions().editor;
  const { t } = useTranslation();
  const [systemFonts, setSystemFonts] = useState<FontFamilyOption[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);

  const loadFonts = async () => {
    setFontsLoading(true);
    try {
      setSystemFonts(await loadSystemFontOptions());
    } catch {
      setSystemFonts([]);
    } finally {
      setFontsLoading(false);
    }
  };

  useEffect(() => {
    void loadFonts();
  }, []);

  const latinOptions = useMemo(
    () =>
      uniqueOptions([makeCurrentOption(latinFont), ...FALLBACK_LATIN_FONT_OPTIONS, ...systemFonts]),
    [latinFont, systemFonts],
  );

  const asianOptions = useMemo(
    () =>
      uniqueOptions([makeCurrentOption(asianFont), ...FALLBACK_ASIAN_FONT_OPTIONS, ...systemFonts]),
    [asianFont, systemFonts],
  );

  return (
    <ListItem dense disableGutters>
      <FontDownloadIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography variant="body2">
        {t('LW.settings.editor.default_fonts')}
      </Typography>
      <Box flexGrow={1} />
      <Stack alignItems="center" direction="row" spacing={1}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Autocomplete
            autoHighlight
            autoSelect
            freeSolo
            getOptionLabel={(option) =>
              typeof option === 'string' ? getFontFamilyLabel(option) : option.label
            }
            isOptionEqualToValue={(option, value) => option.value === value.value}
            onChange={(_event, option) => {
              if (!option) return;
              setLatinFont(
                typeof option === 'string' ? toFontFamilyOption(option).value : option.value,
              );
            }}
            options={latinOptions}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('LW.settings.editor.latin_font')}
                size="small"
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {fontsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
            value={getOptionFromValue(latinFont, latinOptions)}
          />
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Autocomplete
            autoHighlight
            autoSelect
            freeSolo
            getOptionLabel={(option) =>
              typeof option === 'string' ? getFontFamilyLabel(option) : option.label
            }
            isOptionEqualToValue={(option, value) => option.value === value.value}
            onChange={(_event, option) => {
              if (!option) return;
              setAsianFont(
                typeof option === 'string' ? toFontFamilyOption(option).value : option.value,
              );
            }}
            options={asianOptions}
            renderInput={(params) => (
            <TextField {...params} label={t('LW.settings.editor.asian_font')} size="small" />
            )}
            value={getOptionFromValue(asianFont, asianOptions)}
          />
        </FormControl>
        <Tooltip title={t('LW.settings.editor.refresh_system_fonts')}>
          <span>
            <IconButton disabled={fontsLoading} onClick={() => void loadFonts()} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </ListItem>
  );
};
