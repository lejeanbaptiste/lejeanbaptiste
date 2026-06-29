import { clearFindHighlights } from '@src/desktop/find/findEditorHighlights';
import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Tab, Tabs, Typography } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';

export const DocumentTabBar = () => {
  const { activeTabPath, openTabs } = useAppState().project;
  const { contentHasChanged } = useAppState().editor;
  const { closeTab, promptCloseDirtyTab, switchTab } = useActions().project;
  const [leafWriter] = useAtom(leafwriterAtom);

  if (openTabs.length === 0) return null;

  const handleChange = async (_event: React.SyntheticEvent, filePath: string) => {
    if (filePath === activeTabPath) return;
    clearFindHighlights();
    const content = leafWriter ? await leafWriter.getContent() : undefined;
    await switchTab({ content, filePath });
  };

  const handleClose = async (event: React.MouseEvent, filePath: string) => {
    event.stopPropagation();
    clearFindHighlights();

    const tab = openTabs.find((item) => item.filePath === filePath);
    if (!tab) return;

    const isActive = filePath === activeTabPath;
    const isDirty = isActive ? contentHasChanged : tab.dirty;

    if (isDirty && isDesktop()) {
      const contentOverride =
        isActive && leafWriter ? await leafWriter.getContent() : tab.content;
      const result = await promptCloseDirtyTab({
        tab: {
          content: tab.content,
          filePath: tab.filePath,
          filename: tab.filename,
          isTemp: tab.isTemp,
        },
        contentOverride,
      });
      if (result === 'abort' || result === 'handled') return;
    }

    const content =
      filePath === activeTabPath && leafWriter ? await leafWriter.getContent() : undefined;
    await closeTab({ content, filePath });
  };

  return (
    <Tabs
      value={activeTabPath ?? false}
      onChange={(event, value) => void handleChange(event, value as string)}
      variant="scrollable"
      scrollButtons="auto"
      sx={{ minHeight: 28 }}
      TabScrollButtonProps={{ style: { WebkitAppRegion: 'no-drag' } as React.CSSProperties }}
    >
      {openTabs.map((tab) => (
        <Tab
          key={tab.filePath}
          value={tab.filePath}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography component="span" variant="body2">
                {tab.filename}
                {tab.dirty ? ' *' : ''}
                {tab.externalChangePending ? ' ↻' : ''}
              </Typography>
              <IconButton
                component="span"
                size="small"
                onClick={(event) => void handleClose(event, tab.filePath)}
                sx={{ p: 0.25 }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          }
          sx={{ minHeight: 28, textTransform: 'none' }}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />
      ))}
    </Tabs>
  );
};
