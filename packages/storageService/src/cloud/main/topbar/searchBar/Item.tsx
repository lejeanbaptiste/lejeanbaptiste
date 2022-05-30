import CodeIcon from '@mui/icons-material/Code';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import {
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import React, { FC, useState } from 'react';
import type { Content, SearchResultsBlobs } from '../../../../@types/types';
import { useActions, useAppState } from '../../../../overmind';
import ContentMatch from './ContentMatch';

interface ItemProps {
  item: Content | SearchResultsBlobs;
  onPrimaryAction: (item: Content | SearchResultsBlobs) => void;
  onSecondaryAction: (item: Content | SearchResultsBlobs) => void;
}

const Item: FC<ItemProps> = ({ item, onPrimaryAction, onSecondaryAction }) => {
  const { allowAllFileTypes, allowedFileTypes } = useAppState().common;
  const { repository: currentRepo, owner: currentOnwer } = useAppState().cloud;
  const { fetchDocument, navigateTo } = useActions().cloud;
  const { load } = useActions().common;
  const { name, nameHighlight, owner, repository, path, text_matches, type } = item;
  const [showContentMatch, setShowContentMatch] = useState(false);
  const [hover, setHover] = useState(false);

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  const getPath = () => {
    let pathLine = owner ? `${owner.username}/` : `${currentOnwer?.username}/`;
    pathLine += repository ? `${repository.name}/` : `${currentRepo?.name}/`;
    pathLine += path;

    return pathLine;
  };

  const handlePrimaryAction = async () => {
    onPrimaryAction(item);
    if (type === 'folder') navigateTo({ repo: repository, path: `${path}/${name}` });
    if (type === 'file') {
      const document = await fetchDocument({ repo: repository, path, filename: name });
      if (document) load();
    }
  };

  const handleSecondaryAction = () => {
    navigateTo({ repo: repository, path });
    onSecondaryAction(item);
  };

  const isDisabled = () => {
    const isFile = type === 'file';
    const isAllowed = !allowedFileTypes
      ? true
      : allowedFileTypes?.some((type) => name.endsWith(type));
    return !allowAllFileTypes && isFile && !isAllowed;
  };

  return (
    <ListItem
      dense
      disablePadding
      // {...getOptionProps({ option, index })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      secondaryAction={
        hover && (
          <Stack direction="row" spacing={1}>
            {text_matches && (
              <IconButton
                data-testid="tertiary-button"
                edge="end"
                onClick={() => setShowContentMatch(!showContentMatch)}
                size="small"
                title="details"
              >
                <CodeIcon fontSize="inherit" />
              </IconButton>
            )}
            {type === 'file' && (
              <IconButton
                data-testid="secondary-button"
                edge="end"
                onClick={handleSecondaryAction}
                size="small"
                title="show in folder"
              >
                <FolderOpenIcon fontSize="inherit" />
              </IconButton>
            )}
          </Stack>
        )
      }
      title={item.name}
    >
      <ListItemButton
        alignItems="flex-start"
        data-testid="primary-button"
        dense
        disabled={isDisabled()}
        onClick={handlePrimaryAction}
        sx={{ width: '100%', m: 0.5, borderRadius: 1 }}
      >
        {!isSM && (
          <ListItemIcon sx={{ minWidth: 40 }}>
            {type === 'folder' ? <FolderOpenIcon /> : <DescriptionOutlinedIcon />}
          </ListItemIcon>
        )}

        <ListItemText
          disableTypography
          primary={
            nameHighlight ? (
              nameHighlight.map((part, partIndex) => (
                <Typography
                  key={partIndex}
                  component="span"
                  sx={{ fontWeight: part.highlight ? 900 : 400 }}
                >
                  {part.text}
                </Typography>
              ))
            ) : (
              <Typography>{name}</Typography>
            )
          }
          secondary={
            <Box width="90%">
              <Typography
                color="text.secondary"
                sx={{ overflowWrap: 'break-word' }}
                variant="body2"
              >
                {getPath()}
              </Typography>
              <AnimatePresence>
                {text_matches && showContentMatch && <ContentMatch text_matches={text_matches} />}
              </AnimatePresence>
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Item;
