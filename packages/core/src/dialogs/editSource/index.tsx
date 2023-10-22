import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
import type { EditSourceDialogProps } from '../type';

const Editor = lazy(() => import('./Editor').then((module) => ({ default: module.Editor })));

export const EditSourceDialog = ({
  content = '',
  id,
  onClose,
  open = false,
  type = 'content',
}: EditSourceDialogProps) => {
  const { settings } = useAppState().editor;
  const { loadDocumentXML: updateXMLContent, updateXMLHeader } = useActions().document;

  const { t } = useTranslation('leafwriter');

  const [currentContent, setCurrentContent] = useState('');

  const title = type === 'header' ? t('edit header') : t('edit source');

  useEffect(() => {
    setCurrentContent(content);
  }, []);

  const handleUpdateContent = (value: string) => setCurrentContent(value);

  const handleClose = () => onClose && onClose(id);

  const handleChange = () => {
    if (currentContent === content) return onClose && onClose(id);

    if (type === 'content') updateXMLContent(currentContent);
    if (type === 'header') updateXMLHeader(currentContent);

    onClose && onClose(id);
  };

  const Progress = () => (
    <Box display="flex" height={600} width="100%" alignItems="center" justifyContent="center">
      <CircularProgress sx={{ width: '100%' }} />
    </Box>
  );

  return (
    <Dialog
      aria-labelledby="edit-source-title"
      container={document.getElementById(`${settings?.container}`)}
      fullWidth
      maxWidth="lg"
      open={open}
    >
      <DialogTitle
        id="edit-source-title"
        p={0}
        sx={{ textAlign: 'center', fontSize: '1rem', textTransform: 'capitalize' }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ minHeight: 600, padding: 0 }}>
        <Suspense fallback={<Progress />}>
          <Editor content={content} updateContent={handleUpdateContent} />
        </Suspense>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button autoFocus onClick={handleClose}>
          {t('commons.cancel')}
        </Button>
        <Button onClick={handleChange} variant="outlined">
          {t('commons.change')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
