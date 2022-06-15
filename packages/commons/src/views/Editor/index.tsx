import { loadDocument } from '@cwrc/leafwriter-storage-service';
// const Leafwriter = React.lazy(() => import('@cwrc/leafwriter'));
import LoadingMask from '@src/components/loadingMask';
import Page from '@src/components/Page';
import { usePermalink } from '@src/hooks/usePermalink';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import Editor from './LeafWriterContainer';
import TopBar from './topBar';

const EditView: FC = () => {
  const { userState } = useAppState().auth;
  const { resource } = useAppState().storage;

  const { editor } = useActions();
  const { getStorageProviderAuth, openStorageDialog, setResource } = useActions().storage;
  const { showAlertDialog } = useActions().ui;

  const { t } = useTranslation();
  const navigate = useNavigate();

  const { getResourceFromPermalink } = usePermalink();

  useEffect(() => {
    window.addEventListener('keydown', onKeydownHandle);
    return () => window.removeEventListener('keydown', onKeydownHandle);
  }, []);

  useEffect(() => {
    if (userState === 'AUTHENTICATING') return;
    if (userState === 'UNAUTHENTICATED') return navigate('/', { replace: true });

    if (!resource) loadDocumentFromPermalink();
  }, [userState]);

  const loadDocumentFromPermalink = async () => {
    const resource = getResourceFromPermalink();
    if (!resource) return showErrorMessage('Resource not found');
    if (!resource.provider) return showErrorMessage('Provider not found');

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return showErrorMessage('Provider not found');

    const document = await loadDocument(providerAuth, resource);
    if ('error' in document) return showErrorMessage(document.error);

    setResource(document);
  };

  const showErrorMessage = (error?: string) => {
    showAlertDialog({
      type: 'error',
      message: error ?? 'Something went wrong.',
      onClose: () => navigate('/', { replace: true }),
    });
  };

  const onKeydownHandle = (event: KeyboardEvent) => {
    if (!event.metaKey) return;

    let action: 'save' | 'saveAs' | 'load' | '' = '';

    if (event.code === 'KeyS') action = 'save';
    if (event.shiftKey && event.code === 'KeyS') action = 'saveAs';
    if (event.code === 'KeyO') action = 'load';

    if (action === '') return;

    event.preventDefault();
    event.stopPropagation();

    if (action === 'saveAs') return editor.saveAs();
    if (action === 'save') return editor.save();
    if (action === 'load') {
      return openStorageDialog({
        source: 'cloud',
        resource: undefined,
        type: 'load',
      });
    }
  };

  return (
    <Page title={t('home:homepage')}>
      <TopBar />
      {!resource ? <LoadingMask /> : <Editor />}
    </Page>
  );
};

export default EditView;
