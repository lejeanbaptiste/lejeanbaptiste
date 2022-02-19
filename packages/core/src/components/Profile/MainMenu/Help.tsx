import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
} from '@mui/material';
import React, { FC } from 'react';

const HelpButton: FC = () => {
  const helpUrl = 'https://cwrc.ca/CWRC-Writer_Documentation/';

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <HelpOutlineIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary="Documentation" />
      <ListItemSecondaryAction>
        <IconButton
          aria-label="help"
          href={helpUrl}
          rel="noopener noreferrer"
          size="small"
          target="_blank"
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

export default HelpButton;
