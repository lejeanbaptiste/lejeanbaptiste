import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { Box, ListItem, Stack, ToggleButton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { StyledToolTip, ToggleButtonGroup } from '../../../../components';
import { useActions, useAppState } from '../../../../overmind';

export const ThemeAppearance = () => {
  const { t } = useTranslation();
  const { themeAppearance } = useAppState().ui;
  const { setThemeAppearance } = useActions().ui;

  return (
    <ListItem dense disableGutters>
      <SettingsBrightnessIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
        {t(`LW.settings.theme.appearance`)}
      </Typography>
      <Box flexGrow={1} />
      <Stack direction="row">
        <ToggleButtonGroup
          aria-label={t(`LW.settings.theme.appearance`)}
          color="primary"
          exclusive
          onChange={(_event, value) => {
            if (!value || value === themeAppearance) return;
            setThemeAppearance(value);
          }}
          size="small"
          value={themeAppearance}
        >
          <ToggleButton aria-label={t(`LW.settings.theme.light`)} value="light">
            <StyledToolTip enterDelay={1000} title={t(`LW.settings.theme.light`)}>
              <Brightness7Icon sx={{ height: 16, width: 16 }} />
            </StyledToolTip>
          </ToggleButton>
          <ToggleButton aria-label={t(`LW.settings.theme.system`)} value="system">
            <StyledToolTip enterDelay={1000} title={t(`LW.settings.theme.system`)}>
              <Brightness4Icon sx={{ height: 16, width: 16 }} />
            </StyledToolTip>
          </ToggleButton>
          <ToggleButton aria-label={t(`LW.settings.theme.dark`)} value="dark">
            <StyledToolTip enterDelay={1000} title={t(`LW.settings.theme.dark`)}>
              <DarkModeIcon sx={{ height: 16, width: 16 }} />
            </StyledToolTip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </ListItem>
  );
};
