import { Avatar, Box, ListItem, ListItemButton, Stack, Typography } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import type { Organization as OrganizationProps } from '@src/types';

interface Props {
  organization: OrganizationProps;
}

export const Organization = ({ organization }: Props) => {
  const { selectedItem } = useAppState().common;

  const { setSelectedItem } = useActions().common;
  const { navigateTo } = useActions().cloud;

  const { avatar_url, description, id, name } = organization;

  const handleClick = () => setSelectedItem({ organization, type: 'org' });
  const handleDoubleClick = () => navigateTo({ org: organization });

  return (
    <ListItem alignItems="flex-start" disablePadding disableGutters divider title={name}>
      <ListItemButton
        alignItems={description ? 'flex-start' : 'center'}
        data-testid="primary-button"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        selected={selectedItem?.organization?.id === id}
        sx={{ py: 1 }}
      >
        <Box mt={description ? 0 : 0.5} mr={2} py={0.125}>
          <Avatar alt={name} src={avatar_url ?? ''} sx={{ width: 24, height: 24 }} />
        </Box>
        <Stack alignItems="flex-start">
          <Typography>{name}</Typography>
          {description && <Typography variant="caption">{description}</Typography>}
        </Stack>
      </ListItemButton>
    </ListItem>
  );
};
