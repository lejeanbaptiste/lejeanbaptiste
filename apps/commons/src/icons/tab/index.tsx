import { Box, type SxProps, type Theme } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import explorerPng from './tab_explorer.png';
import explorerDarkPng from './tab_explorer.dark.png';
import findPng from './tab_find.png';
import findDarkPng from './tab_find.dark.png';
import xpathPng from './tab_xpath.png';
import xpathDarkPng from './tab_xpath.dark.png';
import tocPng from './tab_toc.png';
import tocDarkPng from './tab_toc.dark.png';
import treePng from './tab_tree.png';
import treeDarkPng from './tab_tree.dark.png';
import entityPng from './tab_entity.png';
import entityDarkPng from './tab_entity.dark.png';

export type SidebarTabId = 'explorer' | 'find' | 'xpath' | 'toc' | 'markup' | 'entities';

const tabIconSources: Record<SidebarTabId, string> = {
  explorer: explorerPng,
  find: findPng,
  xpath: xpathPng,
  toc: tocPng,
  markup: treePng,
  entities: entityPng,
};

const tabIconSourcesDark: Record<SidebarTabId, string> = {
  explorer: explorerDarkPng,
  find: findDarkPng,
  xpath: xpathDarkPng,
  toc: tocDarkPng,
  markup: treeDarkPng,
  entities: entityDarkPng,
};

export const sidebarTabLabels: Record<SidebarTabId, string> = {
  explorer: 'Explorer',
  find: 'Find',
  xpath: 'XPath',
  toc: 'Table of Contents',
  markup: 'Markup',
  entities: 'Entities',
};

export const sidebarTabOrder: SidebarTabId[] = [
  'explorer',
  'find',
  'xpath',
  'toc',
  'markup',
  'entities',
];

interface TabIconProps {
  size?: number;
  sx?: SxProps<Theme>;
  tabId: SidebarTabId;
}

export const TabIcon = ({ tabId, size = 16, sx }: TabIconProps) => {
  const { mode, systemMode } = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
  const src = isDark ? tabIconSourcesDark[tabId] : tabIconSources[tabId];

  return (
    <Box
      aria-hidden
      component="img"
      src={src}
      alt=""
      sx={{
        display: 'block',
        width: size,
        height: size,
        flexShrink: 0,
        objectFit: 'contain',
        ...sx,
      }}
    />
  );
};

/** @deprecated Use TabIcon */
export const TabSvgIcon = TabIcon;
