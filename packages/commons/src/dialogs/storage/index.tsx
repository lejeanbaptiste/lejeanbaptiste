import type { Resource } from '@cwrc/leafwriter-storage-service';
import { LoadingMask } from '@src/components';
import { useFormatConversion, useOpenResource, usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { isValidXml } from '@src/utilities';
import React, { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const StorageDialog = React.lazy(() =>
  import('@cwrc/leafwriter-storage-service/dialog').then((module) => ({
    default: module.StorageDialog,
  })),
);

export const Storage = () => {
  const { user } = useAppState().auth;
  const { storageProviders } = useAppState().providers;
  const { storageDialogState } = useAppState().storage;

  const { setResource } = useActions().editor;
  const { getStorageProvidersAuth } = useActions().providers;
  const { closeStorageDialog } = useActions().storage;

  const location = useLocation();
  const { t } = useTranslation('LWC');

  const { setPermalink } = usePermalink();
  const { openResource } = useOpenResource();

  const { checkDocumentFormat, convertDocument } = useFormatConversion();

  const { open, source, type } = storageDialogState;

  const providers = useMemo(() => getStorageProvidersAuth(), [storageProviders]);

  const handleOnChange = (resource?: Resource) => {
    if (location.pathname !== '/') return;
    setPermalink(resource);
  };

  const handleLoad = async (resource: Resource) => {
    if (!resource.content) return;

    const specialFormat = await checkDocumentFormat(resource.content);
    if (!specialFormat) return loadResource(resource);

    const convertedDocument = await convertDocument({ fromType: specialFormat, resource });
    if (!convertedDocument) return;

    if (convertedDocument.isConverted) {
      resource = {
        content: convertedDocument.content,
        filename: convertedDocument.newFilename,
      };
    }

    loadResource(resource);
  };

  const loadResource = async (resource: Resource) => {
    closeStorageDialog();
    await openResource({ resource });
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
      : { valid: false, error: t('LWC:storage.error.xml_not_well-formed_message') };
  };

  const preferProvider = useMemo(() => {
    if (!user) return providers[0]?.name;
    if (user.prefStorageProvider) return user.prefStorageProvider;

    const prefIdIsStorageProvider = providers.some(
      (provider) => provider.name === user.preferredID,
    );

    return prefIdIsStorageProvider ? user.preferredID : providers[0]?.name;
  }, [user?.preferredID]);

  return (
    <>
      {open && (
        <Suspense fallback={<LoadingMask />}>
          <StorageDialog
            config={{
              allowedMimeTypes: ['application/xml'],
              defaultCommitMessage: 'Updated via LEAF-Writer',
              providers,
              preferProvider,
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
