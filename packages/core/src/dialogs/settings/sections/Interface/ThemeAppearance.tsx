import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { Box, ListItem, Stack, ToggleButton, Typography } from '@mui/material';
import React, { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { StyledToolTip, ToggleButtonGroup } from '../../../../components';
import { useActions, useAppState } from '../../../../overmind';
import type { PaletteMode } from '../../../../types';

type Option = {
  name: PaletteMode;
  Icon: any;
};

const options: Option[] = [
  { name: 'light', Icon: Brightness7Icon },
  { name: 'auto', Icon: Brightness4Icon },
  { name: 'dark', Icon: DarkModeIcon },
];

export const ThemeAppearance = () => {
  const { t } = useTranslation('leafwriter');

  const { setThemeAppearance } = useActions().ui;
  const { themeAppearance } = useAppState().ui;

  const changePaletteMode = (event: MouseEvent<HTMLElement>, value: PaletteMode | null) => {
    if (!value || value === themeAppearance) return;
    setThemeAppearance(value);
  };

  return (
    <ListItem dense disableGutters>
      <SettingsBrightnessIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
        {t('commons.appearance')}
      </Typography>
      <Box flexGrow={1} />
      <Stack direction="row">
        <ToggleButtonGroup
          aria-label="appearance"
          exclusive
          size="small"
          onChange={changePaletteMode}
          value={themeAppearance}
        >
          {options.map(({ name, Icon }) => (
            <ToggleButton
              key={name}
              aria-label={name}
              color="primary"
              size="small"
              value={t(`ui:${name}`).toString()}
            >
              <StyledToolTip enterDelay={1000} title={t(`ui:${name}`) ?? name}>
                <Icon sx={{ height: 16, width: 16 }} />
              </StyledToolTip>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
    </ListItem>
  );
};
