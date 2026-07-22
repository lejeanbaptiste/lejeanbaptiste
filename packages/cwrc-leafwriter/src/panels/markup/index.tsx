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
        backgroundColor: 'background.paper',
      }}
    >
      <Provider>
        <Tree />
      </Provider>
    </Paper>
  );
};
