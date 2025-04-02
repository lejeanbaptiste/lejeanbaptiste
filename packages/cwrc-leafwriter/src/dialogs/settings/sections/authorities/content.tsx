import { AccordionDetails, Link, Stack, Tooltip, Typography } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { IoExtensionPuzzleOutline } from 'react-icons/io5';
import { MdLockOutline } from 'react-icons/md';
import { RxExternalLink } from 'react-icons/rx';
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
    <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2">
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
              <RxExternalLink fontSize="inherit" />
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
    <Stack direction="row" alignItems="center" gap={1}>
      <Typography fontWeight={700} sx={{ textTransform: 'capitalize' }} variant="body2">
        {t('LW.commons.entity types')}
      </Typography>
      <Stack direction="row" gap={1}>
        {entityTypes.map((entityType) => (
          <Tooltip key={entityType} title={capitalizeString(t(`LW.entity.${entityType}`))}>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', p: 0.25 }}>
              <Icon name={entityType} sx={{ height: 14, width: 14 }} />
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
    <Stack gap={1}>
      <Stack direction="row" alignItems="center" gap={1}>
        <IoExtensionPuzzleOutline style={{ height: 14, width: 14 }} />
        {author && (
          <Typography variant="caption">
            {t('LW.commons.addon by')}{' '}
            {author.url ? (
              <Link
                aria-label="navigate to url"
                display="inline-flex"
                alignItems="center"
                gap={0.25}
                href={author.url}
                target="_blank"
                variant="caption"
              >
                {author.name}
                <RxExternalLink fontSize="inherit" />
              </Link>
            ) : (
              <Typography variant="caption">{author.name}</Typography>
            )}
          </Typography>
        )}
      </Stack>
      {isLocal && (
        <Stack direction="row" alignItems="center" gap={1}>
          <MdLockOutline style={{ height: 14, width: 14 }} />
          <Typography variant="caption">{t('LW.messages.Only you can see this')}</Typography>
        </Stack>
      )}
    </Stack>
  );
};
