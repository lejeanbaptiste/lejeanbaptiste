import { ListItem, MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { locales } from '../../../../i18n';
import { useActions, useAppState } from '../../../../overmind';

export const Language = () => {
  const { t } = useTranslation();

  const { currentLocale } = useAppState().ui;
  const { switchLocale } = useActions().ui;

  return (
    <ListItem dense disableGutters sx={{ py: 0.25 }}>
      <TextField
        fullWidth
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
