import ExtensionIcon from '@mui/icons-material/Extension';
import LockOutlineIcon from '@mui/icons-material/LockOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AccordionDetails, Link, Stack, Tooltip, Typography } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../../../db';
import { Icon } from '../../../../icons';
import type { NamedEntityType } from '../../../../types';
import { namedEntityTypes, type AuthorityService } from '../../../../types';
import { capitalizeString } from '../../../../utilities';

export const Content = ({
  author,
  description,
  id,
  isCustom,
  isLocal,
  url,
}: Pick<AuthorityService, 'author' | 'description' | 'id' | 'isCustom' | 'isLocal' | 'url'>) => {
  const { t } = useTranslation();

  const entityTypes = useLiveQuery(
    async () =>
      (await db.lookupServicePreferences.where({ authorityId: id }).toArray()).toSorted((a, b) => {
        return namedEntityTypes.indexOf(a.entityType) - namedEntityTypes.indexOf(b.entityType);
      }),
    [],
    [],
  );

  return (
    <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}>
      <Typography variant="body2" sx={{ fontSize: '0.84rem', lineHeight: 1.4 }}>
        {description}
        {url && (
          <>
            {' '}
            <Link
              display="inline-flex"
              alignItems="center"
              gap=".5rem"
              href={url}
              target="_blank"
              variant="body2"
            >
              {t('LW.commons.Learn more')}
              <OpenInNewIcon fontSize="inherit" />
            </Link>
          </>
        )}
      </Typography>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems={isLocal ? 'flex-start' : 'center'}
      >
        <SupportedEntityTypes entityTypes={entityTypes.map(({ entityType }) => entityType)} />
        {!!isCustom && <CustomInfo {...{ author, isLocal }} />}
      </Stack>
    </AccordionDetails>
  );
};

const SupportedEntityTypes = ({ entityTypes }: { entityTypes: NamedEntityType[] }) => {
  const { t } = useTranslation();
  return (
    <Stack direction="row" alignItems="center" gap={0.75}>
      <Typography fontWeight={600} variant="body2" sx={{ fontSize: '0.82rem' }}>
        {t('LW.commons.entity_types')}
      </Typography>
      <Stack direction="row" gap={0.75}>
        {entityTypes.map((entityType) => (
          <Tooltip key={entityType} title={capitalizeString(t(`LW.entity.${entityType}`))}>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', p: 0.1 }}>
              <Icon name={entityType} sx={{ height: 13, width: 13 }} />
            </Stack>
          </Tooltip>
        ))}
      </Stack>
    </Stack>
  );
};

const CustomInfo = ({
  author,
  isLocal,
}: {
  author?: { name: string; url?: string };
  isLocal?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <Stack gap={0.5}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <ExtensionIcon sx={{ height: 13, width: 13 }} />
        {author && (
          <Typography variant="caption" sx={{ fontSize: '0.76rem' }}>
            {t('LW.commons.added_by')}{' '}
            {author.url ? (
              <Link
                aria-label={t('LW.messages.navigate to url')}
                display="inline-flex"
                alignItems="center"
                gap={0.25}
                href={author.url}
                target="_blank"
                variant="caption"
              >
                {author.name}
                <OpenInNewIcon fontSize="inherit" />
              </Link>
            ) : (
              <Typography variant="caption" sx={{ fontSize: '0.76rem' }}>
                {author.name}
              </Typography>
            )}
          </Typography>
        )}
      </Stack>
      {isLocal && (
        <Stack direction="row" alignItems="center" gap={0.5}>
          <LockOutlineIcon sx={{ height: 13, width: 13 }} />
          <Typography variant="caption" sx={{ fontSize: '0.76rem' }}>
            {t('LW.messages.only_available_on_this_browser')}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};
