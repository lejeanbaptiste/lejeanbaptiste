import { Paper } from '@mui/material';
import { Tree } from './tree';

export const TocPanel = () => {
  return (
    <Paper
      id="toc-panel"
      elevation={5}
      square
      sx={{
        overflow: 'auto',
        height: '100%',
        p: 1,
        backgroundColor: 'background.paper',
      }}
    >
      <Tree />
    </Paper>
  );
};
