import { Card, CardActions, CardContent, Stack, Switch, Typography } from '@mui/material';
import { useSetAtom } from 'jotai';
import { useState } from 'react';
import { toggleLookupAuthorityAtom, toggleLookupEntityAtom } from '../../../../jotai/entity-lookup';
import type { AuthorityService, NamedEntityType } from '../../../../types';
import { EntityType } from './EntityType';

interface AuthorityProps {
  authorityService: AuthorityService;
}

export const Authority = ({ authorityService }: AuthorityProps) => {
  const { disabled, entities, id, name } = authorityService;

  const toggleLookupAuthority = useSetAtom(toggleLookupAuthorityAtom);
  const toggleLookupEntity = useSetAtom(toggleLookupEntityAtom);

  const [hover, setHover] = useState(false);

  return (
    <Card onMouseOver={() => setHover(true)} onMouseOut={() => setHover(false)}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography color="primary" variant="body1">
            {name}
          </Typography>
          <Switch
            checked={!disabled}
            color="primary"
            onChange={() => toggleLookupAuthority(id)}
            size="small"
          />
        </Stack>
        <Typography variant="body2">
          Bacon ipsum dolor amet alcatra short loin venison pork belly, jowl spare ribs pancetta
          frankfurter pork doner. Swine capicola pork loin, corned beef turkey short ribs ground
          round salami sirloin fatback picanha. Salami corned beef brisket turkey tenderloin pork
          loin beef chicken jerky.
        </Typography>
      </CardContent>
      <CardActions>
        <Typography variant="overline">Supported entities</Typography>
        <Stack direction="row">
          {Object.entries(entities).map(([entityName, entityEnabled]) => (
            <EntityType
              key={entityName}
              available={!disabled}
              enabled={entityEnabled}
              onClick={(entityName) => toggleLookupEntity({ authorityId: id, entityName })}
              name={entityName as NamedEntityType}
            />
          ))}
        </Stack>
      </CardActions>
    </Card>
  );
};
