import { List } from '@mui/material';
import { DesktopEncoderName } from './desktop-encoder-name';
import { DesktopWarnings } from './desktop-warnings';
import { Language } from './language';
import { ThemeAppearance } from './theme-appearance';

const isDesktopApp =
  typeof window !== 'undefined' &&
  !!(window as Window & { electronAPI?: unknown }).electronAPI;

export const UI = () => (
  <List dense>
    <ThemeAppearance />
    <Language />
    {isDesktopApp && <DesktopEncoderName />}
    {isDesktopApp && <DesktopWarnings />}
  </List>
);
