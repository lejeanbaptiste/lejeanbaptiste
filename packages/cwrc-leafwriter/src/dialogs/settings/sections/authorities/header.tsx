import { Button, Stack, Switch, Typography } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../../../db';
import type { AuthorityService } from '../../../../types';

interface HeaderProps extends Pick<AuthorityService, 'id' | 'isLocal' | 'name'> {
  expanded: boolean;
  onEditClick: () => void;
}

export const Header = ({ expanded, id, isLocal, name, onEditClick }: HeaderProps) => {
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
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Typography color="primary" fontWeight={600} variant="body2" sx={{ fontSize: '0.92rem' }}>
          {name}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.5} mr={0.5}>
        {isLocal && expanded && (
          <Button
            component="div"
            onClick={onEditClick}
            role="button"
            id={`edit-${id}`}
            size="small"
            sx={{ minWidth: 0, px: 0.75, py: 0.15, fontSize: '0.78rem' }}
          >
            {t('LW.commons.edit')}
          </Button>
        )}
        <Switch checked={!isDisabled} color="primary" id={`switch-${id}`} size="small" />
      </Stack>
    </>
  );
};
