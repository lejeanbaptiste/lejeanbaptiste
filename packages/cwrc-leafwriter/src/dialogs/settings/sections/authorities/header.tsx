import { Button, Stack, Switch, Typography } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../../../db';
import { type AuthorityService } from '../../../../types';

export const Header = ({
  expanded,
  id,
  isLocal,
  name,
}: Pick<AuthorityService, 'id' | 'isLocal' | 'name'> & { expanded: boolean }) => {
  const { t } = useTranslation();

  const isDisabled = useLiveQuery(
    async () =>
      (await db.lookupServicePreferences.where({ authorityId: id }).toArray()).every(
        (type) => type.disabled === true,
      ),
    [],
    false,
  );

  return (
    <>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography color="primary" fontWeight={700} variant="body1">
          {name}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} mr={1}>
        {isLocal && expanded && (
          <Button
            component="div"
            role="button"
            id={`edit-${id}`}
            size="small"
            sx={{ textTransform: 'capitalize' }}
          >
            {t('LW.commons.edit')}
          </Button>
        )}
        <Switch checked={!isDisabled} color="primary" id={`switch-${id}`} size="small" />
      </Stack>
    </>
  );
};
