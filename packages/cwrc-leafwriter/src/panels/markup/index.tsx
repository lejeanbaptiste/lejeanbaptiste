import { Paper } from '@mui/material';
import { Provider } from 'jotai';
import { Tree } from './tree';

export const MarkupPanel = () => {
  return (
    <Paper
      id="markup-panel"
      elevation={5}
      square
      sx={[
        {
          overflow: 'auto',
          height: '100%',
          p: 1,
          backgroundColor: '#f5f5f5',
        },
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: theme.vars.palette.background.paper,
          }),
      ]}
    >
      <Provider>
        <Tree />
      </Provider>
    </Paper>
  );
};
