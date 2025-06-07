import { IconButton, Tooltip } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoMdAddCircleOutline } from 'react-icons/io';
import { CustomAuthorityDialog } from '.';

export const AddCustomAuthority = () => {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={t('LW.settings.authorities.Add Custom Authority')}>
        <IconButton onClick={() => setOpen(true)} size="small" sx={{ mr: 0.75, borderRadius: 2 }}>
          <IoMdAddCircleOutline />
        </IconButton>
      </Tooltip>
      <CustomAuthorityDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};
