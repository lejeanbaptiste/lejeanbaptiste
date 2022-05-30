import { LoadingButton } from '@mui/lab';
import { Button, DialogActions } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

export interface FooterProps {
  onCancel: () => void;
}

const FooterLoad: FC<FooterProps> = ({ onCancel }) => {
  const { selectedItem, source } = useAppState().common;
  const { isLoading } = useAppState().cloud;
  const { load } = useActions().common;
  const { fetchDocument, navigateTo } = useActions().cloud;
  const { t } = useTranslation();

  const handleLoad = async () => {
    if (source !== 'cloud') {
      load();
      return;
    }

    if (!selectedItem) return;

    if (selectedItem.type === 'file' && selectedItem.path) {
      const document = await fetchDocument({ path: selectedItem.path });
      if (document) load();
      return;
    }

    if (selectedItem.type === 'folder') {
      navigateTo({ path: selectedItem.path });
      return;
    }

    if (selectedItem.type === 'repo' && selectedItem.repository) {
      navigateTo({ repo: selectedItem.repository });
      return;
    }

    if (selectedItem.type === 'org' && selectedItem.organization) {
      navigateTo({ org: selectedItem.organization });
      return;
    }
  };

  return (
    <DialogActions data-testid="footer-load" sx={{ justifyContent: 'space-between' }}>
      <Button onClick={onCancel} title="cancel" variant="outlined">
        {t('commons:cancel')}
      </Button>
      <LoadingButton
        disabled={source === 'cloud' && !selectedItem}
        loading={isLoading}
        onClick={handleLoad}
        title="load"
        variant="contained"
      >
        {selectedItem?.type === 'file' ? t('commons:load') : t('commons:open')}
      </LoadingButton>
    </DialogActions>
  );
};

export default FooterLoad;
