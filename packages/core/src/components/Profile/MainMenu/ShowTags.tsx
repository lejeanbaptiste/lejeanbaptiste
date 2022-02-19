import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import {
  Box,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Switch,
} from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import React, { ChangeEvent, FC } from 'react';

const ShowTags: FC = () => {
  const actions = useActions();
  const { editor } = useAppState();

  const handleChangeShowEntities = (event: ChangeEvent<HTMLInputElement>) => {
    actions.editor.showEntities(event.target.checked);
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <StyleOutlinedIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText id="language" primary="Show Entities" />
      <ListItemSecondaryAction>
        <Box
          sx={{
            flex: 2,
            display: 'flex',
            flexDirection: 'column',
            mt: 0.75,
            pl: 1,
          }}
        >
          <Switch
            color="primary"
            checked={editor.showEntities}
            inputProps={{ 'aria-label': 'Entities' }}
            name="Entities"
            onChange={handleChangeShowEntities}
            size="small"
          />
        </Box>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

export default ShowTags;
