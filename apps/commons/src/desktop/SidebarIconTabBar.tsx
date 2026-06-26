import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Box,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  SIDEBAR_TAB_BUTTON_SIZE,
  SIDEBAR_TAB_ICON_SIZE,
} from './sidebarConstants';
import { TabIcon, sidebarTabLabels, sidebarTabOrder, type SidebarTabId } from '@src/icons/tab';

interface SidebarIconTabBarProps {
  activeTab: SidebarTabId;
  collapsed: boolean;
  onSelectTab: (tab: SidebarTabId) => void;
  onToggleCollapse: () => void;
  orientation: 'horizontal' | 'vertical';
}

export const SidebarIconTabBar = ({
  activeTab,
  collapsed,
  onSelectTab,
  onToggleCollapse,
  orientation,
}: SidebarIconTabBarProps) => {
  const isVertical = orientation === 'vertical';
  const tooltipPlacement = isVertical ? 'right' : 'bottom';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        bgcolor: 'background.paper',
        gap: 0,
        flexShrink: 0,
        py: isVertical ? 0.25 : 0,
        px: isVertical ? 0 : 0.25,
        ...(isVertical
          ? {
              width: '100%',
              height: '100%',
            }
          : {
              width: '100%',
              minHeight: SIDEBAR_TAB_BUTTON_SIZE + 4,
              borderBottom: 1,
              borderColor: 'divider',
              flexWrap: 'nowrap',
              overflow: 'hidden',
            }),
      }}
    >
      <ToggleButtonGroup
        exclusive
        orientation={orientation}
        value={activeTab}
        onChange={(_event, value: SidebarTabId | null) => {
          if (value) onSelectTab(value);
        }}
        sx={{
          flex: isVertical ? undefined : 1,
          flexWrap: 'nowrap',
          minWidth: 0,
          '& .MuiToggleButtonGroup-grouped': {
            margin: 0.125,
            border: 0,
            borderRadius: 1,
          },
        }}
      >
        {sidebarTabOrder.map((tabId) => (
          <ToggleButton
            key={tabId}
            value={tabId}
            sx={{
              width: SIDEBAR_TAB_BUTTON_SIZE,
              height: SIDEBAR_TAB_BUTTON_SIZE,
              minWidth: SIDEBAR_TAB_BUTTON_SIZE,
              p: 0.25,
              flexShrink: 0,
            }}
          >
            <Tooltip placement={tooltipPlacement} title={sidebarTabLabels[tabId]}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'text.primary' }}>
                <TabIcon tabId={tabId} size={SIDEBAR_TAB_ICON_SIZE} />
              </Box>
            </Tooltip>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {isVertical && <Box sx={{ flex: 1 }} />}

      <Tooltip
        placement={tooltipPlacement}
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <IconButton
          size="small"
          onClick={onToggleCollapse}
          aria-label="Toggle sidebar panel"
          sx={{ width: SIDEBAR_TAB_BUTTON_SIZE, height: SIDEBAR_TAB_BUTTON_SIZE, flexShrink: 0 }}
        >
          {collapsed ? (
            <ChevronRightIcon fontSize="small" />
          ) : (
            <ChevronLeftIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
};
