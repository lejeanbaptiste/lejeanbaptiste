import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Stack, Typography } from '@mui/material';
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
    <Stack width="100%" py={0.5} spacing={1.25}>
      <Stack direction="row" mx={0.5} gap={1}>
        <InfoOutlinedIcon sx={{ height: 16, width: 16, mt: '2px', flexShrink: 0 }} />
        <Typography
          color="textSecondary"
          variant="body2"
          sx={{ fontSize: '0.8rem', lineHeight: 1.35 }}
        >
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
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ alignItems: 'stretch' }}>
        {entityTypes?.map((service) => (
          <Stack key={service} sx={{ flex: '1 1 180px', minWidth: 160, maxWidth: 240 }}>
            <EntityType entityType={service} />
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
