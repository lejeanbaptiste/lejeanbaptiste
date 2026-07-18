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
import { findCompanionTranslationFiles } from '@src/desktop/translationCompanionOps';
import { readTranslationSettings } from '@src/desktop/translationSettings';
import type { TranslationLanguage } from '@src/desktop/translationTypes';
import { useAppState } from '@src/overmind';
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
  const { activeTabPath } = useAppState().project;

  const [format, setFormat] = useAtom(localExportFormatAtom);
  const [includeTranslations, setIncludeTranslations] = useAtom(exportIncludeTranslationsAtom);
  const [translationLang, setTranslationLang] = useAtom(exportTranslationLangAtom);
  const [includeBibliography, setIncludeBibliography] = useAtom(exportIncludeBibliographyAtom);

  const [languages, setLanguages] = useState<TranslationLanguage[]>([]);

  useEffect(() => {
    const bundle = getActiveProjectBundle();
    if (!bundle || !activeTabPath) return;

    Promise.all([
      readTranslationSettings(bundle),
      findCompanionTranslationFiles(activeTabPath),
    ]).then(([settings, companions]) => {
      // Only offer languages this document actually has a translation file for — a
      // project can be configured for more languages than any given document has been
      // translated into yet.
      const labelByCode = new Map(
        (settings?.languages ?? []).map((language) => [language.code, language.label]),
      );
      const available = companions.map((companion) => ({
        code: companion.lang,
        label: labelByCode.get(companion.lang) ?? companion.lang,
      }));

      setLanguages(available);
      if (available.length > 0 && !translationLang) setTranslationLang(available[0]!.code);
    });
    // Only re-derive when the dialog mounts; translation settings don't change mid-dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabPath]);

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

          <FormControl fullWidth size="small" disabled={!includeTranslations} sx={{ mt: 1 }}>
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
