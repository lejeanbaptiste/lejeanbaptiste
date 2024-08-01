import TranslateIcon from '@mui/icons-material/Translate';
import { Box, ListItem, Stack, ToggleButton, Typography } from '@mui/material';
import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleButtonGroup } from '../../../../components';
import { locales } from '../../../../i18n';
import { useActions, useAppState } from '../../../../overmind';

export const Language = () => {
  const { t, i18n } = useTranslation();

  const { currentLocale } = useAppState().ui;
  const { switchLocale: switchLanguage } = useActions().ui;

  const changeLanguage = (_event: MouseEvent<HTMLElement>, locale: string) => {
    switchLanguage(locale);
    i18n.changeLanguage(locale);
  };

  return (
    <ListItem dense disableGutters>
      <TranslateIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
        {t('LW.language')}
      </Typography>
      <Box flexGrow={1} />
      <Stack direction="row">
        <ToggleButtonGroup
          aria-label="language"
          exclusive
          onChange={changeLanguage}
          value={currentLocale}
        >
          {locales.map((locale) => (
            <ToggleButton
              key={locale}
              aria-label={locale}
              color="primary"
              size="small"
              sx={{ height: 28 }}
              value={locale}
            >
              {t(`LW.languages.${locale}`, { lng: locale, fallbackLng: 'en' })}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
    </ListItem>
  );
};
