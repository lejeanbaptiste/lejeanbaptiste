import { Avatar, Chip, Grid, ListItem, ListItemButton, Stack, Typography } from '@mui/material';
import FolderSpecialOutlinedIcon from '@mui/icons-material/FolderSpecialOutlined';
import type { Repository } from '../../@types/types';
import { useActions, useAppState } from '../../overmind';
import React, { FC } from 'react';

interface RepoProps {
  repo: Repository;
}

const Repo: FC<RepoProps> = ({ repo }) => {
  const { collectionSource } = useAppState().cloud;
  const { navigateTo } = useActions().cloud;
  const { name, description, visibility } = repo;

  const handleClick = () => {
    if (!visibility && visibility === 'private') return;
    navigateTo({ repo });
  };

  return (
    <ListItem alignItems="flex-start" disablePadding disableGutters divider>
      <ListItemButton data-testid={`repository-item-${name}`} alignItems={description ? 'flex-start' : 'center'} onClick={handleClick}>
        <Grid container alignItems={description ? 'flex-start' : 'center'}>
          <Grid item xs="auto" pr={2}>
            <FolderSpecialOutlinedIcon sx={{ mt: 0.5 }} />
          </Grid>
          <Grid item xs>
            <Stack alignItems="flex-start">
              <Stack direction="row" alignItems="center" spacing={1}>
                
                {collectionSource === 'collaborator' && (
                  <Chip
                    avatar={
                      <Avatar
                        alt={repo.owner?.name ?? repo.owner?.username}
                        src={repo.owner?.avatar_url ?? ''}
                      />
                    }
                    label={repo.owner?.name ?? repo.owner?.username}
                    size="small"
                    sx={{ maxWidth: 200, mt: description ? 1 : 0 }}
                    variant="outlined"
                  />
                )}
                <Typography>{name}</Typography>
              </Stack>
              {description && <Typography variant="caption">{description}</Typography>}
            </Stack>
          </Grid>
        </Grid>
      </ListItemButton>
    </ListItem>
  );
};

export default Repo;
