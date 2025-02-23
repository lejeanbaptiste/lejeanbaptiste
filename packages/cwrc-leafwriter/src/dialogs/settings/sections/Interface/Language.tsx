import TranslateIcon from '@mui/icons-material/Translate';
import { Box, ListItem, MenuItem, Select, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { locales } from '../../../../i18n';
import { useActions, useAppState } from '../../../../overmind';

export const Language = () => {
  const { t, i18n } = useTranslation();

  const { currentLocale } = useAppState().ui;
  const { switchLocale } = useActions().ui;

  return (
    <ListItem dense disableGutters>
      <TranslateIcon sx={{ height: 18, width: 18, mx: 1 }} />
      <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
        {t('LW.commons.language')}
      </Typography>
      <Box flexGrow={1} />
      <Select
        id="language-selector"
        onChange={(event) => {
          switchLocale(event.target.value);
          i18n.changeLanguage(event.target.value);
        }}
        size="small"
        value={currentLocale}
      >
        {locales.map((locale) => (
          <MenuItem key={locale} aria-label={locale} color="primary" value={locale}>
            {t(`LW.languages.${locale}`, { lng: locale, fallbackLng: 'en' })}
          </MenuItem>
        ))}
      </Select>
    </ListItem>
  );
};
