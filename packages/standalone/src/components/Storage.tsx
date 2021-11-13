import { Backdrop, LinearProgress } from '@mui/material';
import { usePermalink } from '@src/hooks/permalink';
import { useActions, useAppState } from '@src/overmind';
import React, { FC, Suspense, useEffect } from 'react';

// import { loadDocument, Resource } from '@cwrc/leafwriter-storage-service';
// const StorageDialog = React.lazy(() => import('@cwrc/leafwriter-storage-service'));

import { loadDocument, Resource } from '@cwrc/leafwriter-storage-service/headless';
const StorageDialog = React.lazy(() => import('@cwrc/leafwriter-storage-service/Dialog'));

const Storage: FC = () => {
  const { prefStorageProvider, resource, storageDialogState, userAuthenticated } = useAppState();
  const {
    closeStorageDialog,
    getStorageProviderAuth,
    getStorageProvidersAuth,
    openStorageDialog,
    setResource,
    showMessageDialog,
    isValidXml,
  } = useActions();
  const { parsePermalink, setPermalink } = usePermalink();

  const { open, source, type } = storageDialogState;

  useEffect(() => {
    if (userAuthenticated === true) checkPermalink();
  }, [userAuthenticated]);

  const checkPermalink = () => {
    const permalink = parsePermalink();
    if (!permalink) return;

    if ('error' in permalink || !permalink.valid || !permalink.resource) {
      showMessageDialog({ title: 'Warning', message: permalink.error, onClose: close });
      return;
    }

    if (permalink.resource.filename) return loadDocumentFromPermalink(permalink.resource);
    openStorageDialog({ source: 'cloud', type: 'load', resource: permalink.resource });
  };

  const loadDocumentFromPermalink = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document) return console.log(document);

    console.log(document);
    setResource(document);
  };

  const clickAway = () => {
    setPermalink('/');
    closeStorageDialog();
  };

  const close = () => {
    if (type === 'load') setPermalink('/');
    closeStorageDialog();
  };

  const handleOnChange = (resource?: Resource) => {
    setPermalink(resource);
  };

  const handleLoad = (res: Resource) => {
    console.log(res);
    setResource(res);
    setPermalink(res);
    closeStorageDialog();
  };

  const handleSave = (res: Resource) => {
    console.log(res);
    setResource(res);
    setPermalink(res);
    closeStorageDialog();
  };

  const Progress = () => (
    <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={true}>
      <LinearProgress sx={{ width: '100%' }} />
    </Backdrop>
  );

  const validXML = (content: string) => {
    const isContentValid = isValidXml(content);
    return isContentValid ? { valid: true } : { valid: false, error: 'xml_not_well_formed' };
  };

  return (
    <>
      {type === 'load' && open && (
        <Suspense fallback={<Progress />}>
          <StorageDialog
            config={{
              allowedMimeTypes: ['text/xml'],
              providers: getStorageProvidersAuth(),
              preferProvider: prefStorageProvider,
              validate: validXML,
            }}
            onBackdropClick={clickAway}
            onCancel={close}
            onChange={handleOnChange}
            onLoad={handleLoad}
            open={open}
            source={source}
          />
        </Suspense>
      )}
      {type === 'save' && open && (
        <Suspense fallback={<Progress />}>
          <StorageDialog
            config={{
              allowedMimeTypes: ['text/xml'],
              defaultCommitMessage: 'Updated via leaf-writer',
              providers: getStorageProvidersAuth(),
              preferProvider: prefStorageProvider,
            }}
            onCancel={close}
            onSave={handleSave}
            resource={resource}
            open={open}
            type="save"
          />
        </Suspense>
      )}
    </>
  );
};

export default Storage;
