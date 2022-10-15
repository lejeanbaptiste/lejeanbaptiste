import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';
import React, { type FC, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
import type { PaletteMode } from '../../types';

type Option = {
  name: PaletteMode;
  Icon: any;
};

const options: Option[] = [
  { name: 'light', Icon: Brightness7Icon },
  { name: 'auto', Icon: Brightness4Icon },
  { name: 'dark', Icon: DarkModeIcon },
];

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButtonGroup-grouped': {
    margin: theme.spacing(0.5),
    border: 0,
    '&.Mui-disabled': { border: 0 },
    '&:not(:first-of-type)': {
      borderRadius: theme.shape.borderRadius,
    },
    '&:first-of-type': {
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    textTransform: 'capitalize !important',
  },
  [`& .${tooltipClasses.tooltipPlacementBottom}`]: {
    marginTop: '10px !important',
  },
}));

const ThemeAppearance: FC = () => {
  const { t } = useTranslation(['leafwriter']);

  const { setThemeAppearance } = useActions().ui;
  const { themeAppearance } = useAppState().ui;

  const changePaletteMode = (event: MouseEvent<HTMLElement>, value: PaletteMode | null) => {
    if (!value || value === themeAppearance) return;
    setThemeAppearance(value);
  };

  return (
    <Stack direction="row" alignItems="center">
      <SettingsBrightnessIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography>{t('appearance')}</Typography>
      <Box flexGrow={1} />
      <Stack direction="row">
        <StyledToggleButtonGroup
          aria-label="appearance"
          exclusive
          size="small"
          onChange={changePaletteMode}
          value={themeAppearance}
        >
          {options.map(({ name, Icon }) => (
            <ToggleButton
              key={name}
              color="primary"
              aria-label={name}
              size="small"
              value={t(`ui:${name}`)}
            >
              <StyledToolTip enterDelay={1000} title={t(`ui:${name}`) ?? name}>
                <Icon sx={{ height: 16, width: 16 }} />
              </StyledToolTip>
            </ToggleButton>
          ))}
        </StyledToggleButtonGroup>
      </Stack>
    </Stack>
  );
};

export default ThemeAppearance;
