import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
} from '@mui/material';
import { getActiveProjectBundle } from '@src/desktop/activeProjectBundle';
import { readTranslationSettings } from '@src/desktop/translationSettings';
import type { TranslationLanguage } from '@src/desktop/translationTypes';
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LOCAL_EXPORT_FORMATS,
  exportIncludeBibliographyAtom,
  exportIncludeTranslationsAtom,
  exportTranslationLangAtom,
  localExportFormatAtom,
  type LocalExportFormat,
} from '../store';

const FORMAT_LABEL_KEY: Record<LocalExportFormat, string> = {
  docx: 'LWC.dialogs.importExport.docx document',
  odt: 'LWC.dialogs.importExport.odt document',
  rtf: 'LWC.dialogs.importExport.rtf document',
  markdown: 'LWC.dialogs.importExport.markdown document',
  text: 'LWC.dialogs.importExport.text document',
};

export const ExportView = () => {
  const { t } = useTranslation();

  const [format, setFormat] = useAtom(localExportFormatAtom);
  const [includeTranslations, setIncludeTranslations] = useAtom(exportIncludeTranslationsAtom);
  const [translationLang, setTranslationLang] = useAtom(exportTranslationLangAtom);
  const [includeBibliography, setIncludeBibliography] = useAtom(exportIncludeBibliographyAtom);

  const [languages, setLanguages] = useState<TranslationLanguage[]>([]);

  useEffect(() => {
    const bundle = getActiveProjectBundle();
    if (!bundle) return;
    readTranslationSettings(bundle).then((settings) => {
      const available = settings?.languages ?? [];
      setLanguages(available);
      if (available.length > 0 && !translationLang) setTranslationLang(available[0]!.code);
    });
    // Only re-derive when the dialog mounts; translation settings don't change mid-dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box width="100%">
      <FormControl>
        <RadioGroup
          value={format}
          onChange={(event) => setFormat(event.target.value as LocalExportFormat)}
        >
          {LOCAL_EXPORT_FORMATS.map((value) => (
            <FormControlLabel
              key={value}
              value={value}
              control={<Radio />}
              label={t(FORMAT_LABEL_KEY[value])}
            />
          ))}
        </RadioGroup>
      </FormControl>

      {languages.length > 0 && (
        <Box mt={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeTranslations}
                onChange={(event) => setIncludeTranslations(event.target.checked)}
              />
            }
            label={t('LWC.dialogs.importExport.include translations')}
          />

          {includeTranslations && languages.length > 1 && (
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="export-translation-lang-label">
                {t('LWC.dialogs.importExport.translation language')}
              </InputLabel>
              <Select
                labelId="export-translation-lang-label"
                label={t('LWC.dialogs.importExport.translation language')}
                value={translationLang ?? ''}
                onChange={(event) => setTranslationLang(event.target.value)}
              >
                {languages.map((language) => (
                  <MenuItem key={language.code} value={language.code}>
                    {language.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      )}

      <Box mt={1}>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeBibliography}
              onChange={(event) => setIncludeBibliography(event.target.checked)}
            />
          }
          label={t('LWC.dialogs.importExport.include bibliography')}
        />
      </Box>
    </Box>
  );
};
