import { LoadingButton } from '@mui/lab';
import { Button, DialogActions } from '@mui/material';
import { useActions, useAppState } from '../overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

export interface FooterProps {
  onCancel: () => void;
}

const FooterLoad: FC<FooterProps> = ({ onCancel }) => {
  const { isLoading } = useAppState().cloud;
  const { load } = useActions().common;
  const { t } = useTranslation();

  const handleLoad = () => load();

  return (
    <DialogActions sx={{ justifyContent: 'space-between' }}>
      <Button onClick={onCancel} variant="outlined">
        {t('commons:cancel')}
      </Button>
      <LoadingButton loading={isLoading} onClick={handleLoad} variant="contained">
        {t('commons:load')}
      </LoadingButton>
    </DialogActions>
  );
};

export default FooterLoad;
