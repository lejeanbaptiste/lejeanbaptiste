import { Box, IconButton, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { DocumentTabBar } from './DocumentTabBar';

export const TITLEBAR_HEIGHT = 36;

const MAC_TRAFFIC_LIGHT_WIDTH = 78;

const isMacOS = () =>
  typeof navigator !== 'undefined' &&
  (navigator.userAgentData
    ? navigator.userAgentData.platform === 'macOS'
    : /Mac/i.test(navigator.userAgent));

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export const TitleBar = () => {
  const mac = isMacOS();
  const [isMaximized, setIsMaximized] = useState(false);

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

      {/* Document tabs — background stays draggable; individual tab buttons set no-drag */}
      <Box
        sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <DocumentTabBar />
      </Box>

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
