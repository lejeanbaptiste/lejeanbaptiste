import TranslateIcon from '@mui/icons-material/Translate';
import { Box, ListItem, Stack, ToggleButton, Typography } from '@mui/material';
import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleButtonGroup } from '../../../../components';
import { supportedLanguages } from '../../../../config';
import { useActions, useAppState } from '../../../../overmind';

export const Language = () => {
  const { t, i18n } = useTranslation('leafwriter');

  const { language } = useAppState().ui;
  const { switchLanguage } = useActions().ui;

  const changeLanguage = (_event: MouseEvent<HTMLElement>, code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <ListItem dense disableGutters>
      <TranslateIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
        {t('language')}
      </Typography>
      <Box flexGrow={1} />
      <Stack direction="row">
        <ToggleButtonGroup
          aria-label="language"
          exclusive
          onChange={changeLanguage}
          value={language.code}
        >
          {Array.from(supportedLanguages.values()).map(({ code, shortName }) => (
            <ToggleButton
              key={code}
              aria-label={shortName}
              color="primary"
              size="small"
              sx={{ height: 28 }}
              value={code}
            >
              {shortName}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
    </ListItem>
  );
};
