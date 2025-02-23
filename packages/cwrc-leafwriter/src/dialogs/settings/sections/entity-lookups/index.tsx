import { Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { IoMdInformationCircleOutline } from 'react-icons/io';
import { db } from '../../../../db';
import { namedEntityTypes, type NamedEntityType } from '../../../../types';
import { EntityType } from './entity-type';

export const EntityLookups = () => {
  const { t } = useTranslation();

  const entityTypes = useLiveQuery(() =>
    db.lookupServicePreferences.toCollection().primaryKeys((key: string[]) => {
      const uniqueTypes = new Set(key.map((key) => key.split('-')[1] as NamedEntityType));
      const sortedTypes = Array.from(uniqueTypes).toSorted((a, b) => {
        return namedEntityTypes.indexOf(a) - namedEntityTypes.indexOf(b);
      });
      return sortedTypes;
    }),
  );

  return (
    <Stack width="100%" py={1} spacing={2}>
      <Stack direction="row" mx={1} gap={1.5}>
        <IoMdInformationCircleOutline
          style={{ height: 16, width: 16, marginLeft: 8, marginTop: 2 }}
        />
        <Typography color="textSecondary" variant="body2">
          {t(
            'LW.settings.authorities.messages.You can rearrange authorities to prioritize and activate or deactivate them for each entity type',
          )}
          .{' '}
          {t(
            'LW.settings.authorities.messages.Deactivated authorities will not be shown in entity lookups',
          )}
          .
        </Typography>
      </Stack>
      <Grid container spacing={1}>
        {entityTypes?.map((service) => (
          <Grid key={service} size={4}>
            <EntityType entityType={service} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
};
