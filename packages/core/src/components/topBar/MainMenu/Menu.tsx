import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu as MenuMui,
  MenuItem,
  MenuList,
  Typography,
} from '@mui/material';
import React, { FC } from 'react';
import { useNavigate } from 'react-router';
import { useAppState, useActions } from '../../../overmind';

interface MenuProps {
  anchor: HTMLDivElement;
  onClose: () => void;
}

const Menu: FC<MenuProps> = ({ anchor, onClose }) => {
  const { resource } = useAppState().document;
  const { saveDocument } = useActions().editor;
  const navigate = useNavigate();
  const open = Boolean(anchor);

  const handleOpen = () => {
    window.writer?.showLoadDialog();
    onClose();
  };

  const handleSave = () => {
    const forceSaveAs = !resource?.filename ? true : false;
    saveDocument(forceSaveAs);
    onClose();
  };

  const handleSaveAs = () => {
    saveDocument(true);
    window.writer?.save(true);
    onClose();
  };

  const handleCloseDocument = () => {
    onClose();
    window.writer?.destroy();
    navigate('/', { replace: true });
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <MenuMui anchorEl={anchor} onClose={handleClose} open={open}>
      <MenuList dense sx={{ width: 250, maxWidth: '100%' }}>
        <MenuItem onClick={handleOpen}>
          <ListItemIcon>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open</ListItemText>
          <Typography variant="body2" color="text.secondary">
            ⌘O
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleSave}>
          <ListItemIcon>
            <CloudQueueIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save</ListItemText>
          <Typography variant="body2" color="text.secondary">
            ⌘S
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleSaveAs}>
          <ListItemIcon>
            <FilterDramaOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save As</ListItemText>
          <Typography variant="body2" color="text.secondary">
            ⇧⌘S
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleCloseDocument}>Close</MenuItem>
      </MenuList>
    </MenuMui>
  );
};

export default Menu;
