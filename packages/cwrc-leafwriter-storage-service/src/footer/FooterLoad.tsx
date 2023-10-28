import { LoadingButton } from '@mui/lab';
import { Button, DialogActions } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

export interface FooterProps {
  onCancel: () => void;
}

export const FooterLoad = ({ onCancel }: FooterProps) => {
  const { resource, selectedItem, source } = useAppState().common;
  const { isLoading } = useAppState().cloud;
  const { load } = useActions().common;
  const { fetchDocument, fetchDocumentFromUrl, navigateTo } = useActions().cloud;
  const { t } = useTranslation('LWStorageService');

  const handleLoad = async () => {
    if (source === 'local' || source === 'paste') {
      load();
      return;
    }
    if (source === 'url') {
      if (!resource?.url) return;
      const resourceDocument = await fetchDocumentFromUrl(resource.url);
      load(resourceDocument);
      return;
    }

    if (!selectedItem) return;

    if (selectedItem.type === 'file' && selectedItem.path) {
      const resource = await fetchDocument({ path: selectedItem.path });
      load(resource);
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
      <Button onClick={onCancel} size="small" title="cancel">
        {t('commons.cancel')}
      </Button>
      <LoadingButton
        disabled={source === 'cloud' && !selectedItem}
        loading={isLoading}
        onClick={handleLoad}
        title="load"
        size="small"
        variant="outlined"
      >
        {selectedItem?.type === 'file' ? t('commons.load') : t('commons.open')}
      </LoadingButton>
    </DialogActions>
  );
};
