import { Avatar, Grid, ListItem, ListItemButton, Stack, Typography } from '@mui/material';
import React, { FC } from 'react';
import type { Organization } from '../../types';
import { useActions, useAppState } from '../../overmind';

interface OrgProps {
  org: Organization;
}

const Org: FC<OrgProps> = ({ org }) => {
  const { selectedItem } = useAppState().common;
  const { setSelectedItem } = useActions().common;
  const { navigateTo } = useActions().cloud;
  const { name, description } = org;

  const handleClick = () => setSelectedItem({ organization: org, type: 'org' });

  const handleDoubleClick = () => {
    navigateTo({ org });
  };

  return (
    <ListItem alignItems="flex-start" disablePadding disableGutters divider title={name}>
      <ListItemButton
        alignItems={description ? 'flex-start' : 'center'}
        data-testid="primary-button"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        selected={selectedItem?.organization?.id === org.id}
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
