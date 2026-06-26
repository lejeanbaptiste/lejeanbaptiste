import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Tab, Tabs, Typography } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { useAtom } from 'jotai';

export const DocumentTabBar = () => {
  const { activeTabPath, openTabs } = useAppState().project;
  const { switchTab, closeTab } = useActions().project;
  const [leafWriter] = useAtom(leafwriterAtom);

  if (openTabs.length === 0) return null;

  const handleChange = async (_event: React.SyntheticEvent, filePath: string) => {
    if (filePath === activeTabPath) return;
    const content = leafWriter ? await leafWriter.getContent() : undefined;
    await switchTab({ content, filePath });
  };

  const handleClose = async (event: React.MouseEvent, filePath: string) => {
    event.stopPropagation();
    const content =
      filePath === activeTabPath && leafWriter ? await leafWriter.getContent() : undefined;
    await closeTab({ content, filePath });
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Tabs
        value={activeTabPath ?? false}
        onChange={(event, value) => void handleChange(event, value as string)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ minHeight: 40 }}
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
            sx={{ minHeight: 40, textTransform: 'none' }}
          />
        ))}
      </Tabs>
    </Box>
  );
};
