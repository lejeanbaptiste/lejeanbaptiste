import TranslateIcon from '@mui/icons-material/Translate';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { type FC, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
import { supportedLanguages } from '../../utilities/util';

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButtonGroup-grouped': {
    margin: theme.spacing(0.5),
    border: 0,
    '&.Mui-disabled': {
      border: 0,
    },
    '&:not(:first-of-type)': {
      borderRadius: theme.shape.borderRadius,
    },
    '&:first-of-type': {
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

const Language: FC = () => {
  const { t, i18n } = useTranslation();

  const { language } = useAppState().ui;
  const { switchLanguage } = useActions().ui;

  const changeLanguage = (event: MouseEvent<HTMLElement>, code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <Stack direction="row" alignItems="center">
      <TranslateIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography>{t('ui:language')}</Typography>
      <Box flexGrow={1} />
      <Stack direction="row">
        <StyledToggleButtonGroup
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
        </StyledToggleButtonGroup>
      </Stack>
    </Stack>
  );
};

export default Language;
