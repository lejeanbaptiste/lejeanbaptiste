import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { formatDistance } from 'date-fns';
import React, { FC, useState } from 'react';
import type { ILatestCommit } from '../../types/Provider';
import type { Content as ContentType } from '../../types';
import { useActions, useAppState } from '../../overmind';
import ContentDetails from './ContentDetails';

interface ContentProps {
  content: ContentType;
}

const Content: FC<ContentProps> = ({ content }) => {
  const { allowAllFileTypes, allowedFileTypes, dialogType, selectedItem } = useAppState().common;
  const { getLatestCommit, fetchDocument, navigateTo } = useActions().cloud;
  const { load, setFilename, setSelectedItem } = useActions().common;

  const [latestCommit, setLatestCommig] = useState<ILatestCommit | null>(null);

  const { name, path, type } = content;

  const isDisabled = () => {
    const isFolder = type === 'folder';

    const isAllowed = !allowedFileTypes
      ? true
      : allowedFileTypes?.some((type) => content.name.endsWith(type));
    return !allowAllFileTypes && !isFolder && !isAllowed;
  };

  const handleClick = async () => {
    if (type !== 'folder' && dialogType === 'save') {
      setFilename(name);
      return;
    }

    setSelectedItem({ path, type });
  };

  const handleDoubleClick = async () => {
    if (type === 'folder') {
      navigateTo({ path });
      return;
    }

    if (dialogType === 'save') {
      setFilename(name);
      return;
    }

    const document = await fetchDocument({ path });
    if (document) load();
  };

  const handleSecondaryActionClick = async () => {
    const latestCommit = await getLatestCommit(path);
    if (latestCommit?.date) {
      latestCommit.relativeDate = formatDistance(Date.parse(latestCommit.date), new Date(), {
        addSuffix: true,
      });
    }
    setLatestCommig(latestCommit);
  };

  return (
    <ListItem
      alignItems="flex-start"
      disablePadding
      disableGutters
      divider
      secondaryAction={
        selectedItem?.path === path &&
        !latestCommit && (
          <IconButton
            data-testid="secondary-button"
            edge="end"
            onClick={handleSecondaryActionClick}
            size="small"
            sx={{ mr: 1 }}
            title="details"
          >
            <InfoOutlinedIcon fontSize="inherit" />
          </IconButton>
        )
      }
      title={name}
    >
      <ListItemButton
        alignItems={latestCommit ? 'flex-start' : 'center'}
        data-testid="primary-button"
        disabled={isDisabled()}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        selected={selectedItem?.path === path}
        sx={{
          color: ({ palette }) => {
            return dialogType === 'save' ? palette.text.disabled : palette.text.primary;
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          {type === 'folder' ? <FolderOpenIcon /> : <DescriptionOutlinedIcon />}
        </ListItemIcon>
        <ListItemText
          disableTypography
          primary={<Typography>{name}</Typography>}
          secondary={latestCommit && <ContentDetails latestCommit={latestCommit} />}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Content;
