import { IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { IoMdAddCircleOutline } from 'react-icons/io';

export const AddAuthority = () => {
  const { t } = useTranslation();
  return (
    <Tooltip title={t('LW.settings.authorities.Add Custom Authority')}>
      <IconButton sx={{ borderRadius: 2 }} size="small">
        <IoMdAddCircleOutline />
      </IconButton>
    </Tooltip>
  );
};
