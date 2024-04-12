import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { Provider } from 'jotai';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../overmind';
import type { EditSourceDialogProps } from '../type';
import { Footer } from './components/footer';
import { Loader } from './components/loader';
import { useDialog } from './hooks/useDialog';

const Editor = lazy(() => import('./editor').then((module) => ({ default: module.Editor })));

export const EditSourceDialog = ({
  content = '',
  id,
  onClose,
  open = false,
  type = 'content',
}: EditSourceDialogProps) => {
  const { settings } = useAppState().editor;
  const { t } = useTranslation('leafwriter');
  const { resetContext } = useDialog();

  const title = type === 'header' ? t('leafwriter:edit_header') : t('leafwriter:edit_source');

  const handleClose = () => {
    resetContext();
    onClose?.(id);
  };

  return (
    <Dialog
      aria-labelledby="edit-source-title"
      container={document.getElementById(`${settings?.container}`)}
      fullWidth
      maxWidth="lg"
      open={open}
    >
      <Provider>
        <DialogTitle
          id="edit-source-title"
          p={0}
          sx={{ fontSize: '1rem', textAlign: 'center', textTransform: 'capitalize' }}
        >
          {title}
        </DialogTitle>
        <DialogContent sx={{ minHeight: 600, padding: 0 }}>
          <Suspense fallback={<Loader />}>
            <Editor initialContent={content} type={type} />
          </Suspense>
        </DialogContent>
        <Footer onCancel={handleClose} onDone={handleClose} />
      </Provider>
    </Dialog>
  );
};
