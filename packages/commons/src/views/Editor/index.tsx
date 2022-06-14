import { loadDocument, saveDocument } from '@cwrc/leafwriter-storage-service';
import type { Types } from '@cwrc/leafwriter';
import { Backdrop, LinearProgress } from '@mui/material';
import LoadingMask from '@src/components/loadingMask';
import Page from '@src/components/Page';
import { usePermalink } from '@src/hooks/usePermalink';
import { useActions, useAppState } from '@src/overmind';
import React, { FC, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { IAnnotationUserProfile, Resource } from '../../@types/types';

const Leafwriter = React.lazy(() => import('@cwrc/leafwriter'));

const Editor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { parsePermalink, setPermalink } = usePermalink();
  const { resource, user, userAuthenticated } = useAppState();

  const {
    addToRecentDocument,
    getStorageProviderAuth,
    getLincsAauthenticationToken,
    getUserProfile,
    openStorageDialog,
    setResource,
    signOut,
    showMessageDialog,
  } = useActions();

  const [userProfile, setUserProfile] = useState<IAnnotationUserProfile | undefined>();

  useEffect(() => {
    if (resource) {
      setPermalink(resource);
      addToRecentDocument(resource);
    }
  }, []);

  useEffect(() => {
    if (userAuthenticated === 'authenticating') return;
    if (!userAuthenticated) return navigate('/', { replace: true });

    const profile = getUserProfile();
    if (!profile) return navigate('/');
    setUserProfile(profile);

    resource ? setPermalink(resource) : checkPermalink();
  }, [userAuthenticated]);

  useEffect(() => {
    if (resource) {
      if (!getUserProfile()) return navigate('/', { replace: true });

      setPermalink(resource);
      addToRecentDocument(resource);
    } else {
      checkPermalink();
    }
  }, [resource]);

  const checkPermalink = async () => {
    const permalink = parsePermalink();
    if (!permalink) return navigate('/', { replace: true });

    if ('error' in permalink || !permalink.valid || !permalink.resource) {
      showMessageDialog({
        title: 'Warning',
        message: permalink.error,
        onClose: () => navigate('/', { replace: true }),
      });
      return;
    }

    if (!permalink.resource.filename) return navigate('/', { replace: true });

    loadDocumentFromPermalink(permalink.resource);
  };

  const loadDocumentFromPermalink = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    setPermalink(document);
    addToRecentDocument(document);
  };

  const handleLoadRequest = () => {
    openStorageDialog({ source: 'cloud', resource: undefined, type: 'load' });
  };

  const handleSaveRequest = async (document: Types.LWDocument, saveAs?: boolean) => {
    if (document.file) setResource(document.file);

    if (saveAs) {
      openStorageDialog({ source: 'cloud', resource: document.file, type: 'save' });
      return { success: true };
    }

    if (!document.file?.provider) return { success: false, reason: 'Provider not found' };
    const providerAuth = getStorageProviderAuth(document.file.provider);
    if (!providerAuth) return { success: false, reason: 'Provider token not found' };

    const response = await saveDocument(providerAuth, document.file, true);
    if ('error' in response) {
      return { success: false, reason: response.error };
    }

    return { success: true, hash: response.hash };
  };

  const Progress = () => (
    <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={true}>
      <LinearProgress sx={{ width: '100%' }} />
    </Backdrop>
  );

  return (
    <Page title={t('home:homepage')}>
      {!resource || !userProfile ? (
        <Progress />
      ) : (
        <Suspense fallback={<Progress />}>
          <Leafwriter
            document={{
              file: resource,
              url: resource.url ?? '',
              xml: resource.content ?? '',
            }}
            editor={{
              credentials: { nssiToken: getLincsAauthenticationToken },
              lookups: lookUpsConfig,
              legacy: {
                cwrcRootUrl: './', // '.' | './'
                helpUrl: 'https://cwrc.ca/CWRC-Writer_Documentation/',
                nerveUrl: 'https://localhost/nerve/',
                proxyCssEndpoint: '/schema/css/',
                proxyXmlEndpoint: '/schema/xml/',
              },
            }}
            onLoadRequest={handleLoadRequest}
            onSaveRequest={handleSaveRequest}
            user={{ ...userProfile, signOut }}
          />
        </Suspense>
      )}
      {!resource ? <LoadingMask /> : <Editor />}
    </Page>
  );
};

export default Editor;

const lookUpsConfig: Types.ILookupsConfig = {
  authorities: [
    // ['cwrc', { config: { entityCollectionsUrl: '', entityFormsRoot: '', collectionsRoot: '' } }],
    'viaf',
    ['wikidata', { enabled: true }],
    'dbpedia',
    ['getty', { entities: ['person', ['place', { enabled: false }]] }],
    'lgpn',
    ['geonames', { config: { username: 'cwrcgeonames' } }],
  ],
  showNoLinkButton: true,
  showCreateNewButton: false,
  showEditButton: false,
  serviceType: 'custom',
};
