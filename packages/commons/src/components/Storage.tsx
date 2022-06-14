import type { Resource } from '@cwrc/leafwriter-storage-service';
import { Backdrop, LinearProgress } from '@mui/material';
import { usePermalink } from '@src/hooks/usePermalink';
import { useActions, useAppState } from '@src/overmind';
import React, { FC, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router';

const StorageDialog = React.lazy(() => import('@cwrc/leafwriter-storage-service'));

const Storage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resource, storageDialogState, user, userAuthenticated } = useAppState();
  const {
    closeStorageDialog,
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

    if (!permalink.resource.filename) {
      openStorageDialog({ source: 'cloud', type: 'load', resource: permalink.resource });
    }
  };



  const handleOnChange = (resource?: Resource) => {
    if (location.pathname !== '/') return;
    setPermalink(resource);
  };

  const handleLoad = (res: Resource) => {
    setResource(res);
    setPermalink(res);
    closeStorageDialog();
    navigate('/edit', { replace: true });

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
    return isContentValid ? { valid: true } : { valid: false, error: 'xml_not_well_formed' };
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

export default Storage;
