import { Box, type SxProps, type Theme } from '@mui/material';
import explorerPng from './tab_explorer.png';
import findPng from './tab_find.png';
import xpathPng from './tab_xpath.png';
import tocPng from './tab_toc.png';
import treePng from './tab_tree.png';
import entityPng from './tab_entity.png';

export type SidebarTabId = 'explorer' | 'find' | 'xpath' | 'toc' | 'markup' | 'entities';

const tabIconSources: Record<SidebarTabId, string> = {
  explorer: explorerPng,
  find: findPng,
  xpath: xpathPng,
  toc: tocPng,
  markup: treePng,
  entities: entityPng,
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

export const TabIcon = ({ tabId, size = 16, sx }: TabIconProps) => (
  <Box
    aria-hidden
    component="img"
    src={tabIconSources[tabId]}
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

/** @deprecated Use TabIcon */
export const TabSvgIcon = TabIcon;
