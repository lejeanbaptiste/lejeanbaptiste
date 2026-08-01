import { Stack, Typography, useTheme } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../icons/index';
import { attachToEntityIdAtom, lookupTypeAtom } from './store';

export const Header = () => {
  const { entity } = useTheme();
  const { t } = useTranslation();

  const lookupType = useAtomValue(lookupTypeAtom);
  const attachToEntityId = useAtomValue(attachToEntityIdAtom);

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" py={1} gap={1}>
      <Icon
        name={entity[lookupType].icon}
        sx={{ height: 20, width: 26, color: entity[lookupType].color.main }}
      />
      <Typography sx={{ textTransform: 'capitalize' }} variant="h6">
        {attachToEntityId
          ? t('LW.lookups.link authority', { defaultValue: 'Link authority' })
          : t(`LW.lookups.find entity`, { entity: lookupType })}
      </Typography>
    </Stack>
  );
};
