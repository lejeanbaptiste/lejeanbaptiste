import { ListItem, MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { locales } from '../../../../i18n';
import { useActions, useAppState } from '../../../../overmind';
import { useSettingsValidation } from '../../settingsValidationContext';

export const Language = () => {
  const { t } = useTranslation();

  const { currentLocale } = useAppState().ui;
  const { switchLocale } = useActions().ui;
  const { attempted, languageValid } = useSettingsValidation();

  return (
    <ListItem dense disableGutters sx={{ py: 0.25 }}>
      <TextField
        error={attempted && !languageValid}
        fullWidth
        helperText={attempted && !languageValid ? t('LW.desktop.settings.field_required') : undefined}
        id="language-selector"
        label={t('LW.commons.language')}
        onChange={(event) => {
          switchLocale(event.target.value);
        }}
        select
        size="small"
        value={currentLocale}
      >
        <MenuItem disabled value="">
          {t('LW.commons.select_language')}
        </MenuItem>
        {locales.map((locale) => (
          <MenuItem key={locale} aria-label={locale} color="primary" value={locale}>
            {t(`LW.languages.${locale}`, { lng: locale, fallbackLng: 'en' })}
          </MenuItem>
        ))}
      </TextField>
    </ListItem>
  );
};
