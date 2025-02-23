import { List } from '@mui/material';
import { Language } from './language';
import { ThemeAppearance } from './theme-appearance';

export const Interface = () => (
  <List dense>
    <ThemeAppearance />
    <Language />
  </List>
);
