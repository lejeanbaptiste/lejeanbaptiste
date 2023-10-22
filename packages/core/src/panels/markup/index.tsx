import { Paper } from '@mui/material';
import { Provider } from 'jotai';
import { Tree } from './tree';

export const MarkupPanel = () => {
  return (
    <Paper
      id="markup-panel"
      elevation={5}
      square
      sx={{
        overflow: 'auto',
        height: '100%',
        p: 1,
        bgcolor: ({ palette }) => (palette.mode === 'dark' ? palette.background.paper : '#f5f5f5'),
      }}
    >
      <Provider>
        <Tree />
      </Provider>
    </Paper>
  );
};
