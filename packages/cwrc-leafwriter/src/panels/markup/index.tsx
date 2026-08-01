import { Paper, Typography } from '@mui/material';
import { Provider } from 'jotai';
import type { MarkupTreeSyncMode } from '../../overmind/ui/state';
import { Tree } from './tree';

export const MarkupPanel = ({ syncMode = 'live' }: { syncMode?: MarkupTreeSyncMode }) => {
  return (
    <Paper
      id="markup-panel"
      elevation={5}
      square
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        p: 1,
        backgroundColor: 'background.paper',
      }}
    >
      {syncMode === 'off' ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
          Markup tree disabled. Enable it in Settings → Markup panel.
        </Typography>
      ) : (
        <Provider>
          <Tree syncMode={syncMode} />
        </Provider>
      )}
    </Paper>
  );
};
