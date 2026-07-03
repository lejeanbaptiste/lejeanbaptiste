import { ListItem, MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import type { PaletteMode } from '../../../../types';

export const ThemeAppearance = () => {
  const { t } = useTranslation();
  const { themeAppearance } = useAppState().ui;
  const { setThemeAppearance } = useActions().ui;

  return (
    <ListItem dense disableGutters sx={{ py: 0.25 }}>
      <TextField
        fullWidth
        label={t(`LW.settings.theme.appearance`)}
        onChange={(event) => {
          const value = event.target.value as PaletteMode;
          if (!value || value === themeAppearance) return;
          setThemeAppearance(value);
        }}
        select
        size="small"
        value={themeAppearance}
      >
        <MenuItem value="light">{t(`LW.settings.theme.light`)}</MenuItem>
        <MenuItem value="system">{t(`LW.settings.theme.system`)}</MenuItem>
        <MenuItem value="dark">{t(`LW.settings.theme.dark`)}</MenuItem>
      </TextField>
    </ListItem>
  );
};
