import { List } from '@mui/material';
import { DesktopStartup } from './desktop-startup';
import { DesktopWarnings } from './desktop-warnings';
import { Language } from './language';
import { TagBubble } from './tag-bubble';
import { ThemeAppearance } from './theme-appearance';

const isDesktopApp =
  typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

export const UI = () => (
  <List dense>
    <ThemeAppearance />
    <Language />
    <TagBubble />
    {isDesktopApp && <DesktopStartup />}
    {isDesktopApp && <DesktopWarnings />}
  </List>
);
