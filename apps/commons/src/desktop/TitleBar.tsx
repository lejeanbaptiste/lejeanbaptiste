import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { AchievementsDialog } from './achievements/AchievementsDialog';
import { DocumentTabBar } from './DocumentTabBar';

export const TITLEBAR_HEIGHT = 36;

const MAC_TRAFFIC_LIGHT_WIDTH = 78;

const getUserAgentPlatform = (): string | undefined => {
  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;
  return userAgentData?.platform;
};

const isMacOS = () =>
  typeof navigator !== 'undefined' &&
  (getUserAgentPlatform() ? getUserAgentPlatform() === 'macOS' : /Mac/i.test(navigator.userAgent));

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export const TitleBar = () => {
  const mac = isMacOS();
  const [isMaximized, setIsMaximized] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  useEffect(() => {
    if (mac) return;
    void window.electronAPI?.isWindowMaximized().then(setIsMaximized);
    const off = window.electronAPI?.onWindowMaximized(setIsMaximized);
    return off;
  }, [mac]);

  return (
    <Box
      sx={{
        height: TITLEBAR_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        userSelect: 'none',
        cursor: 'default',
      }}
      style={dragStyle}
      onDoubleClick={() => void window.electronAPI?.maximizeWindow()}
    >
      {/* Space for macOS traffic lights, or a small left pad on other platforms */}
      <Box sx={{ width: mac ? MAC_TRAFFIC_LIGHT_WIDTH : 8, flexShrink: 0 }} />

      {/* App menu button for Windows / Linux (macOS uses the system menu bar) */}
      {!mac && (
        <Box sx={{ flexShrink: 0 }} style={noDragStyle}>
          <IconButton
            size="small"
            aria-label="Application menu"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              void window.electronAPI?.popupAppMenu?.(rect.left, rect.bottom);
            }}
            sx={{ borderRadius: 0, width: 40, height: TITLEBAR_HEIGHT }}
          >
            <Typography variant="caption" sx={{ lineHeight: 1 }}>☰</Typography>
          </IconButton>
        </Box>
      )}

      {/* Document tabs — background stays draggable; individual tab buttons set no-drag */}
      <Box
        sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <DocumentTabBar />
      </Box>

      {/* Service record (achievements) */}
      <Box sx={{ flexShrink: 0 }} style={noDragStyle}>
        <Tooltip title="Service Record">
          <IconButton
            aria-label="Service Record"
            onClick={() => setAchievementsOpen(true)}
            size="small"
            sx={{ borderRadius: 0, width: 40, height: TITLEBAR_HEIGHT }}
          >
            <MilitaryTechIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <AchievementsDialog
        onClose={() => setAchievementsOpen(false)}
        open={achievementsOpen}
      />

      {/* Custom window controls for Windows / Linux */}
      {!mac && (
        <Box sx={{ display: 'flex', flexShrink: 0 }} style={noDragStyle}>
          <IconButton
            size="small"
            onClick={() => void window.electronAPI?.minimizeWindow()}
            sx={{ borderRadius: 0, width: 40, height: TITLEBAR_HEIGHT }}
          >
            <Typography variant="caption" sx={{ lineHeight: 1 }}>—</Typography>
          </IconButton>
          <IconButton
            size="small"
            onClick={() => void window.electronAPI?.maximizeWindow()}
            sx={{ borderRadius: 0, width: 40, height: TITLEBAR_HEIGHT }}
          >
            <Typography variant="caption" sx={{ lineHeight: 1 }}>
              {isMaximized ? '❐' : '□'}
            </Typography>
          </IconButton>
          <IconButton
            size="small"
            onClick={() => void window.electronAPI?.closeWindow()}
            sx={{
              borderRadius: 0,
              width: 40,
              height: TITLEBAR_HEIGHT,
              '&:hover': { bgcolor: '#e81123', color: 'white' },
            }}
          >
            <Typography variant="caption" sx={{ lineHeight: 1 }}>✕</Typography>
          </IconButton>
        </Box>
      )}
    </Box>
  );
};
