import { DialogTitle, Icon } from '@mui/material';
import { getIcon } from '@src/icons';
import { useStore } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { dialogActionAtom } from '../store';

export const Header = () => {
  const { t } = useTranslation('LWC');

  const dialogAction = useStore().get(dialogActionAtom);

  return (
    <DialogTitle
      id="alert-dialog-title"
      display="flex"
      justifyContent="center"
      alignItems="center"
      py={2.5}
      gap={1}
      textTransform="capitalize"
    >
      <Icon component={getIcon(dialogAction === 'import' ? 'importIcon' : 'download')} />
      {dialogAction === 'import'
        ? t('LWC:storage.import document')
        : t('LWC:storage.export document')}
    </DialogTitle>
  );
};
