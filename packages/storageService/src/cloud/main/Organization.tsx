import { Avatar, Grid, ListItem, ListItemButton, Stack, Typography } from '@mui/material';
import type { Organization } from '../../@types/types';
import { useActions } from '../../overmind';
import React, { FC } from 'react';

interface OrgProps {
  org: Organization;
}

const Org: FC<OrgProps> = ({ org }) => {
  const { navigateTo } = useActions().cloud;
  const { name, description } = org;

  const handleClick = () => navigateTo({ org });

  return (
    <ListItem alignItems="flex-start" disablePadding disableGutters divider>
      <ListItemButton
        alignItems={description ? 'flex-start' : 'center'}
        onClick={handleClick}
        sx={{ py: 1 }}
      >
        <Grid container alignItems={description ? 'flex-start' : 'center'}>
          <Grid item xs="auto" pr={2}>
            <Avatar
              alt={org.name}
              src={org.avatar_url ?? ''}
              sx={{ width: 24, height: 24, mt: description ? 0.5 : 0 }}
            />
          </Grid>
          <Grid item xs>
            <Stack alignItems="flex-start">
              <Typography>{name}</Typography>
              {description && <Typography variant="caption">{description}</Typography>}
            </Stack>
          </Grid>
        </Grid>
      </ListItemButton>
    </ListItem>
  );
};

export default Org;
