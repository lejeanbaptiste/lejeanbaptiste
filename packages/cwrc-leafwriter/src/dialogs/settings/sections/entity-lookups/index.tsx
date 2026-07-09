import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Stack, Grid, Typography } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../../../db';
import { namedEntityTypes, type NamedEntityType } from '../../../../types';
import { EntityType } from './entity-type';

export const EntityLookups = () => {
  const { t } = useTranslation();

  const entityTypes = useLiveQuery(() =>
    db.lookupServicePreferences.toCollection().primaryKeys((key: string[]) => {
      const uniqueTypes = new Set(key.map((key) => key.split(':')[1] as NamedEntityType));
      const sortedTypes = Array.from(uniqueTypes).toSorted((a, b) => {
        return namedEntityTypes.indexOf(a) - namedEntityTypes.indexOf(b);
      });
      return sortedTypes;
    }),
  );

  return (
    <Stack width="100%" py={1} spacing={2}>
      <Stack direction="row" mx={1} gap={1.5}>
        <InfoOutlinedIcon sx={{ height: 16, width: 16, ml: 1, mt: '2px' }} />
        <Typography color="textSecondary" variant="body2">
          {t('LW.settings.authorities.messages.rearrange authorities to prioritize results')}.{' '}
          {t(
            'LW.settings.authorities.messages.activate or deactivate authorities for each entity type',
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
