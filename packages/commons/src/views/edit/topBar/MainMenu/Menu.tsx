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
import { useActions, useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useNavigate } from 'react-router';

interface MenuProps {
  anchor: HTMLDivElement;
  onClose: () => void;
}

const Menu: FC<MenuProps> = ({ anchor, onClose }) => {
  const { isDirty } = useAppState().editor;
  const { editor, storage, ui } = useActions();

  const navigate = useNavigate();
  const open = Boolean(anchor);

  const handleOpen = () => {
    onClose();
    storage.openStorageDialog({
      source: 'cloud',
      resource: undefined,
      type: 'load',
    });
  };

  const handleSave = async () => {
    onClose();
    const saved = await editor.save();
    if (saved?.success === true) storage.updateRecentDocument();
  };

  const handleSaveAs = async () => {
    onClose();
    const saved = await editor.saveAs();
    if (saved?.success === true) storage.updateRecentDocument();
  };

  const handleCloseDocument = async () => {
    onClose();
    if (!isDirty) {
      editor.close();
      editor.setIsDirty(false);
      navigate('/', { replace: true });
      return;
    }

    ui.showMessageDialog({
      title: 'Unsaved changes',
      message: 'You have made changes. Do you want to save or dicard them?',
      closable: true,
      labelYesButton: 'Save',
      labelNoButton: 'Discard',
      onClose: () => ui.closeCloseMessageDialog(),
      onYes: async () => {
        const saved = await editor.save();
        if (saved?.success === true) storage.updateRecentDocument();
        ui.closeCloseMessageDialog();
      },
      onNo: () => {
        ui.closeCloseMessageDialog();
        editor.setIsDirty(false);
        editor.close();
        navigate('/', { replace: true });
      },
    });
  };

  const handleClose = () => onClose();

  const options = [
    { Icon: FolderOpenIcon, title: 'Open', shortcut: ' ⌘O', action: handleOpen },
    { Icon: CloudQueueIcon, title: 'Save', shortcut: ' ⌘S', action: handleSave },
    { Icon: FilterDramaOutlinedIcon, title: 'Save As', shortcut: ' ⌘⌥⇧S', action: handleSaveAs },
  ];

  return (
    <MenuMui anchorEl={anchor} onClose={handleClose} open={open}>
      <MenuList dense sx={{ width: 250, maxWidth: '100%' }}>
        {options.map(({ Icon, title, shortcut, action }) => (
          <MenuItem key={shortcut} onClick={action}>
            {Icon && (
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText>{title}</ListItemText>
            {shortcut && (
              <Typography variant="body2" color="text.secondary">
                {shortcut}
              </Typography>
            )}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleCloseDocument}>Close</MenuItem>
      </MenuList>
    </MenuMui>
  );
};

export default Menu;
