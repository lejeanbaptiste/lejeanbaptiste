import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '@src/overmind';
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
  const { t } = useTranslation();
  const { desktopWindowMode } = useAppState().ui;
  const { setDesktopWindowMode } = useActions().ui;
  const [isMaximized, setIsMaximized] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  useEffect(() => {
    if (mac) return;
    void window.electronAPI?.isWindowMaximized().then(setIsMaximized);
    const off = window.electronAPI?.onWindowMaximized(setIsMaximized);
    return off;
  }, [mac]);

  const inDatabase = desktopWindowMode === 'database';

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
      <Box sx={{ width: mac ? MAC_TRAFFIC_LIGHT_WIDTH : 8, flexShrink: 0 }} />

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
            <Typography variant="caption" sx={{ lineHeight: 1 }}>
              ☰
            </Typography>
          </IconButton>
        </Box>
      )}

      <Box
        sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <DocumentTabBar />
      </Box>

      <Box sx={{ flexShrink: 0, px: 0.5 }} style={noDragStyle}>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={() => setDesktopWindowMode(inDatabase ? 'editor' : 'database')}
          endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          sx={{
            textTransform: 'none',
            borderRadius: 5,
            px: 1.5,
            py: 0.25,
            minHeight: 26,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {inDatabase
            ? t('LWC.desktop.database_window.editor_pill', { defaultValue: 'Editor' })
            : t('LWC.desktop.database_window.pill', { defaultValue: 'Database Window' })}
        </Button>
      </Box>

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
      <AchievementsDialog onClose={() => setAchievementsOpen(false)} open={achievementsOpen} />

      {!mac && (
        <Box sx={{ display: 'flex', flexShrink: 0 }} style={noDragStyle}>
          <IconButton
            size="small"
            onClick={() => void window.electronAPI?.minimizeWindow()}
            sx={{ borderRadius: 0, width: 40, height: TITLEBAR_HEIGHT }}
          >
            <Typography variant="caption" sx={{ lineHeight: 1 }}>
              —
            </Typography>
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
            <Typography variant="caption" sx={{ lineHeight: 1 }}>
              ✕
            </Typography>
          </IconButton>
        </Box>
      )}
    </Box>
  );
};
