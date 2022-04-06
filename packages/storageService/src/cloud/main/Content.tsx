import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import type { Content as ContentType } from '../../@types/types';
import { useAppState, useActions } from '../../overmind';
import React, { FC } from 'react';

interface ContentProps {
  content: ContentType;
}

const Content: FC<ContentProps> = ({ content }) => {
  const { allowAllFileTypes, allowedFileTypes, dialogType } = useAppState().common;
  const { fetchDocument, navigateTo } = useActions().cloud;
  const { load , setFilename} = useActions().common;
  const { name, path, type } = content;

  const isDisabled = () => {
    const isFolder = type === 'folder';
    const isAllowed = !allowedFileTypes
      ? true
      : allowedFileTypes?.some((type) => content.name.endsWith(type));
    return !allowAllFileTypes && !isFolder && !isAllowed;
  };

  const handleClick = async () => {
    if (type === 'folder') {
      navigateTo({ path });
      return;
    }

    if (dialogType === 'save') {
      setFilename(name)
      return;
    }

    const document = await fetchDocument({ path });
    if (document) load();
  };

  return (
    <ListItem alignItems="flex-start" disablePadding disableGutters divider>
      <ListItemButton data-testid={`content-button-${name}`}onClick={handleClick} disabled={isDisabled()}>
        <ListItemIcon>
          {type === 'folder' ? <FolderOpenIcon /> : <DescriptionOutlinedIcon />}
        </ListItemIcon>
        <ListItemText primary={name} />
      </ListItemButton>
    </ListItem>
  );
};

export default Content;
