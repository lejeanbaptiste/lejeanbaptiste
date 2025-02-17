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
import { useActions, useAppState } from '@src/overmind';
import type { Content as ContentProps } from '@src/types';
import type { LatestCommit } from '@src/types/Provider';
import { formatDistance } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ContentDetails } from './content-details';

interface Props {
  content: ContentProps;
}

export const Content = ({ content }: Props) => {
  const { allowAllFileTypes, allowedFileTypes, dialogType, selectedItem } = useAppState().common;
  const { getLatestCommit, fetchDocument, navigateTo } = useActions().cloud;
  const { load, setFilename, setSelectedItem } = useActions().common;

  const [latestCommit, setLatestCommig] = useState<LatestCommit | null>(null);

  const { name, path, type } = content;

  const isDisabled = () => {
    const isFolder = type === 'folder' || type === 'dir';

    const isAllowed = !allowedFileTypes
      ? true
      : allowedFileTypes?.some((type) => name.endsWith(type));
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
    if (type === 'folder' || type === 'dir') {
      navigateTo({ path });
      return;
    }

    if (dialogType === 'save') {
      setFilename(name);
      return;
    }

    const resource = await fetchDocument({ path });
    load(resource);
  };

  const handleSecondaryActionClick = async () => {
    if (latestCommit) {
      setLatestCommig(null);
      return;
    }

    const commit = await getLatestCommit(path);
    if (commit?.date) {
      commit.relativeDate = formatDistance(Date.parse(commit.date), new Date(), {
        addSuffix: true,
      });
    }
    setLatestCommig(commit);
  };

  return (
    <ListItem
      alignItems="flex-start"
      disablePadding
      disableGutters
      divider
      secondaryAction={
        selectedItem?.path === path && (
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
        sx={[
          { color: (theme) => theme.palette.text.primary },
          dialogType === 'save' && { color: (theme) => theme.palette.text.disabled },
        ]}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          {type === 'folder' || type === 'dir' ? <FolderOpenIcon /> : <DescriptionOutlinedIcon />}
        </ListItemIcon>
        <ListItemText
          disableTypography
          primary={<Typography>{name}</Typography>}
          secondary={
            latestCommit && (
              <AnimatePresence mode="wait">
                <ContentDetails latestCommit={latestCommit} />
              </AnimatePresence>
            )
          }
        />
      </ListItemButton>
    </ListItem>
  );
};
