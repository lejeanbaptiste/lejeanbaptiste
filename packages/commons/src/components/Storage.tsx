import type { Resource } from '@cwrc/leafwriter-storage-service';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { isValidXml } from '@src/utilities';
import React, { Suspense, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { LoadingMask } from './LoadingMask';

const StorageDialog = React.lazy(() => import('@cwrc/leafwriter-storage-service'));

export const Storage: FC = () => {
  const { user } = useAppState().auth;
  const { storageDialogState } = useAppState().storage;

  const { setResource } = useActions().editor;
  const { getStorageProvidersAuth } = useActions().providers;
  const { closeStorageDialog } = useActions().storage;

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const { setPermalink } = usePermalink();

  const { open, source, type } = storageDialogState;

  const handleOnChange = (resource?: Resource) => {
    if (location.pathname !== '/') return;
    setPermalink(resource);
  };

  const handleLoad = (res: Resource) => {
    setResource(res);
    const permalink = setPermalink(res);
    closeStorageDialog();
    navigate(`/edit${permalink ?? ''}`, { replace: true });

    //? open on a new tab
    //! works fine with cloud document on the cloud.
    //! The problem is how to pass local document to the new tab
    // const permalink = parsePermalink();
    // const newTabLocation = `${window.location.origin}/edit${window.location.search}`
    // window.open(newTabLocation, 'test');
  };

  const handleSave = (res: Resource) => {
    setResource(res);
    setPermalink(res);
    closeStorageDialog();
  };

  const close = () => {
    closeStorageDialog();
    if (location.pathname !== '/') return;
    if (type === 'load') setPermalink('/');
  };

  const clickAway = () => {
    closeStorageDialog();
    if (location.pathname !== '/') return;
    setPermalink('/');
  };

  const validXML = (content: string) => {
    const isContentValid = isValidXml(content);
    return isContentValid
      ? { valid: true }
      : { valid: false, error: t('storage:error.xml_not_well-formed_message') };
  };

  return (
    <>
      {open && (
        <Suspense fallback={<LoadingMask />}>
          <StorageDialog
            config={{
              allowedMimeTypes: ['application/xml'],
              defaultCommitMessage: 'Updated via LEAF-Writer',
              providers: getStorageProvidersAuth(),
              preferProvider: user?.prefStorageProvider,
              validate: validXML,
            }}
            onBackdropClick={type === 'load' ? clickAway : undefined}
            onCancel={close}
            onChange={handleOnChange}
            onLoad={handleLoad}
            onSave={handleSave}
            open={open}
            resource={storageDialogState.resource}
            source={source}
            type={type}
          />
        </Suspense>
      )}
    </>
  );
};
