import { List } from '@mui/material';
import { Language } from './language';
import { ThemeAppearance } from './theme-appearance';

export const UI = () => (
  <List dense>
    <ThemeAppearance />
    <Language />
  </List>
);
