import type { Resource } from '@cwrc/leafwriter-storage-service';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { isValidXml } from '@src/utilities';
import React, { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingMask } from '../LoadingMask';
import { InterceptFormatImportDialog } from './components';

const StorageDialog = React.lazy(() => import('@cwrc/leafwriter-storage-service'));

export const Storage = () => {
  const { user } = useAppState().auth;
  const { storageProviders } = useAppState().providers;
  const { storageDialogState } = useAppState().storage;

  const { setResource } = useActions().editor;
  const { getStorageProvidersAuth } = useActions().providers;
  const { checkDocumentFormat, convertTranskribusToTei, closeStorageDialog } = useActions().storage;
  const { notifyViaSnackbar, openDialog } = useActions().ui;

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const { setPermalink } = usePermalink();

  const { open, source, type } = storageDialogState;

  const providers = useMemo(() => getStorageProvidersAuth(), [storageProviders]);

  const handleOnChange = (resource?: Resource) => {
    if (location.pathname !== '/') return;
    setPermalink(resource);
  };

  const handleLoad = (res: Resource) => {
    if (!res.content) return;

    const format = checkDocumentFormat(res.content);
    if (!format)
    
    if (format) {
      openDialog({
        props: {
          icon: 'importExportRoundedIcon',
          preventEscape: true,
          title: t('importExport:Convert_Document').toString(),
          Body: () => <InterceptFormatImportDialog format={format} />,
          actions: [
            { action: 'cancel', label: `${t('commons:cancel')}` },
            {
              action: 'noConvertOpen',
              label: `${t('importExport:try_to_open_it_without_converting')}`,
            },
            {
              action: 'convertOpen',
              label: `${t('importExport:convert_and_open')}`,
              variant: 'outlined',
            },
          ],
          onBeforeClose: async (action) => {
            if (action !== 'convertOpen') return;
            if (!res.content) return;

            const response = await convertTranskribusToTei({ ...res });
            if (response instanceof Error) {
              notifyViaSnackbar({
                message: `${t('commons:Conversion failed')}. ${response.message}`,
                options: { variant: 'error' },
              });
              return false;
            }

            loadResource(response);
          },
          onClose: async (action) => {
            if (action === 'cancel') return;
            if (action === 'noConvertOpen') loadResource(res);

            closeStorageDialog();
          },
        },
      });
      return;
    }
    loadResource(res);
  };

  const loadResource = (res: Resource) => {
    setResource(res);
    const permalink = setPermalink(res);
    closeStorageDialog();

    const route = res.writePermission === false ? 'view' : 'edit';
    navigate(`/${route}${permalink ?? ''}`, { replace: true });

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

  const preferProvider = useMemo(() => {
    if (!user) return providers[0]?.name;
    if (user.prefStorageProvider) return user.prefStorageProvider;

    const prefIdIsStorageProvider = providers.some(
      (provider) => provider.name === user.preferredID
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
