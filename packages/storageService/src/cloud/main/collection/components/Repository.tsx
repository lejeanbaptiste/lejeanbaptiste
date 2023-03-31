import FolderSpecialOutlinedIcon from '@mui/icons-material/FolderSpecialOutlined';
import GppGoodRoundedIcon from '@mui/icons-material/GppGoodRounded';
import {
  Avatar,
  Box,
  Chip,
  ListItem,
  ListItemButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import type { Repository as RepositoryPros } from '../../../../types';

interface Props {
  repository: RepositoryPros;
}

export const Repository = ({ repository }: Props) => {
  const { selectedItem } = useAppState().common;
  const { collectionSource } = useAppState().cloud;

  const { setSelectedItem } = useActions().common;
  const { navigateTo } = useActions().cloud;

  const { t } = useTranslation();

  const { description, id, name, owner, visibility, writePermission } = repository;

  const handleClick = () => {
    if (visibility === 'private') return;
    setSelectedItem({ repository, type: 'repo' });
  };

  const handleDoubleClick = () => {
    if (visibility === 'private') return;
    navigateTo({ repo: repository });
  };

  return (
    <ListItem alignItems="flex-start" disablePadding disableGutters divider title={name}>
      <ListItemButton
        alignItems={description ? 'flex-start' : 'center'}
        data-testid="primary-button"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        selected={selectedItem?.repository?.id === id}
      >
        <Box mt={description ? 0 : 0.5} mr={2} py={0.125}>
          <FolderSpecialOutlinedIcon />
        </Box>
        <Stack alignItems="flex-start" width="100%">
          <Stack direction="row" alignItems="center" spacing={1}>
            {collectionSource === 'collaborator' && (
              <Chip
                avatar={
                  <Avatar alt={owner?.name ?? owner?.username} src={owner?.avatar_url ?? ''} />
                }
                label={owner?.name ?? owner?.username}
                size="small"
                sx={{ maxWidth: 200, mt: description ? 1 : 0 }}
                variant="outlined"
              />
            )}
            <Typography flexGrow={1}>{name}</Typography>
          </Stack>
          {description && <Typography variant="caption">{description}</Typography>}
        </Stack>
        {writePermission && (
          <Box mt={1}>
            <Tooltip
              componentsProps={{
                tooltip: { sx: { '&::first-letter': { textTransform: 'uppercase' } } },
              }}
              title={t('cloud:shared_with_me')}
            >
              <GppGoodRoundedIcon fontSize="small" />
            </Tooltip>
          </Box>
        )}
      </ListItemButton>
    </ListItem>
  );
};
