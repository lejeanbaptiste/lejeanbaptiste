import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import { Box, Stack, ToggleButton, Typography } from '@mui/material';
import React, { type FC } from 'react';
import { useActions, useAppState } from '../../overmind';

const ShowEntities: FC = () => {
  const actions = useActions();
  const { editor } = useAppState();

  const handleChangeShowEntities = () => {
    actions.editor.showEntities(!editor.showEntities);
  };

  return (
    <Stack direction="row" alignItems="center">
      <StyleOutlinedIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography>Show Entities</Typography>
      <Box flexGrow={1} />

      <ToggleButton
        color="primary"
        onChange={handleChangeShowEntities}
        selected={editor.showEntities}
        size="small"
        sx={{ border: 0 }}
        value={editor.showEntities}
      >
        {editor.showEntities ? (
          <RemoveIcon sx={{ height: 16, width: 16, transform: 'rotate(90deg)' }} />
        ) : (
          <CircleOutlinedIcon sx={{ height: 16, width: 16 }} />
        )}
      </ToggleButton>
    </Stack>
  );
};

export default ShowEntities;
