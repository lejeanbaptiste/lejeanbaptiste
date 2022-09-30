import { type Leafwriter } from '@cwrc/leafwriter';
import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { StorageProviderName } from '@src/services';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useEffect } from 'react';

let leafWriter: Leafwriter | null = null;

export const useLeafWriter = () => {
  const { isDirty } = useAppState().editor;

  const { close, save, saveAs } = useActions().editor;
  const { download, getStorageProviderAuth, setResource } = useActions().storage;
  const { notifyViaSnackbar, openDialog } = useActions().ui;

  const navigate = useNavigate();
  const { t } = useTranslation();

  const { getResourceFromPermalink } = usePermalink();

  useEffect(() => {
    leafWriter?.setIsEditorDirty(isDirty);
  }, [isDirty]);

  const setCurrentLeafWriter = (lw: Leafwriter | null) => (leafWriter = lw);

  const loadDocumentFromPermalink = async () => {
    const resource = getResourceFromPermalink();
    if (!resource) return showErrorMessage(t('Resource not found'));
    if (!resource.provider) return showErrorMessage(t('Provider not found'));

    const providerAuth = getStorageProviderAuth(resource.provider as StorageProviderName);
    if (!providerAuth) return showErrorMessage(t('Provider not found'));

    const document = await loadDocument(providerAuth, resource);
    if ('error' in document) return showErrorMessage(document.error);

    setResource(document);
  };

  const showErrorMessage = (errorMessage: string) => {
    openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: errorMessage,
        onClose: async () => disposeLeafWriter(),
      },
    });
  };

  const handleDownload = async () => {
    if (!leafWriter) return;
    const content = await leafWriter.getContent();
    download(content);
  };

  const handleSave = async (action: 'save' | 'saveAs' = 'save') => {
    if (!leafWriter) return;

    const content = await leafWriter.getContent();

    if (action === 'saveAs') {
      saveAs(content);
      return;
    }

    const saved = await save(content);

    if (!saved.success && saved.error?.message === 'conflict') return;

    const type = saved.success ? 'success' : saved.error?.type ?? 'info';
    const message = saved.success
      ? t('Document Saved')
      : `${t('Something went wrong')}. ${t('Document not saved')}!`;

    if (saved.success) leafWriter.setIsEditorDirty(false);

    notifyViaSnackbar({ message, options: { variant: type } });
  };

  const saveFeedback = (saved: boolean) => {
    const type = saved ? 'success' : 'error';
    const message = saved
      ? t('Document Saved')
      : `${t('Something went wrong')}. ${t('Document not saved')}!`;

    notifyViaSnackbar({ message, options: { variant: type } });

    if (!leafWriter) return;
    if (saved) leafWriter.setIsEditorDirty(false);
  };

  const handleCloseDocument = () => {
    if (!isDirty) return disposeLeafWriter();

    openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'warning',
        title: t('Unsaved changes'),
        actions: [
          { action: 'cancel', label: t('cancel') },
          { action: 'discard', label: t('discard changes') },
        ],
        //@ts-ignore
        onClose: async (action: string) => {
          if (action !== 'discard') return;
          disposeLeafWriter();
        },
      },
    });
  };

  const disposeLeafWriter = () => {
    leafWriter?.dispose();
    leafWriter = null;
    navigate('/', { replace: true });

    close();
  };

  return {
    disposeLeafWriter,
    handleCloseDocument,
    handleDownload,
    handleSave,
    leafWriter,
    loadDocumentFromPermalink,
    saveFeedback,
    setCurrentLeafWriter,
  };
};
