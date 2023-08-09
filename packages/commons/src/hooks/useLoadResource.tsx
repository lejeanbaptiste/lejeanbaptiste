import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { Typography } from '@mui/material';
import { db } from '@src/db';
import { useLeafWriter, usePermalink } from '@src/hooks';
import { useActions } from '@src/overmind';
import { isErrorMessage } from '@src/types';
import { renameFileAsCopy } from '@src/utilities';
import queryString from 'query-string';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export const useLoadResource = () => {
  const { setResource } = useActions().editor;
  const { getStorageProviderAuth } = useActions().providers;
  const { loadSample, loadFromUrl } = useActions().storage;
  const { openDialog } = useActions().ui;

  const location = useLocation();
  let [, setSearchParams] = useSearchParams();

  const navigate = useNavigate();
  const { t } = useTranslation('LWC');

  const { disposeLeafWriter } = useLeafWriter();
  const { getResourceFromPermalink } = usePermalink();

  const loadFromPermalink = async () => {
    const resource = await getResourceFromPermalink();
    if (!resource) return showErrorMessage(t('LWC:storage.warning.check_URL_structure'));
    if (isErrorMessage(resource)) {
      showErrorMessage(resource.message);
      return;
    }

    if (resource.category && resource.url) {
      const content = await loadSample(resource.url);
      if (content instanceof Error) return showErrorMessage(content.message);

      setResource({ content, filename: `${resource.title}.xml` });
      return;
    }

    if (resource.isLocal) {
      //remove id from url
      const params = queryString.parse(location.search);
      if (typeof params.filename === 'string') setSearchParams({ filename: params.filename });
      //remove temp
      if (typeof params.id === 'string') await db.documentRequested.delete(params.id);

      setResource(resource);
      return;
    }

    if (!resource.provider) return showErrorMessage(t('LWC:storage.provider_not_found'));

    //Load document from RAW if user is not signed in
    if (resource.url?.includes('https://raw.githubusercontent')) {
      const content = await loadFromUrl(resource.url);
      if (content instanceof Error) return showErrorMessage(content.message);
      const filename = resource.filename ? renameFileAsCopy(resource.filename) : undefined;
      setResource({ content, filename });
      return;
    }

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return showErrorMessage(t('LWC:storage.provider_not_found'));

    const document = await loadDocument(providerAuth, resource);
    if (document instanceof Error) return showErrorMessage(document.message);

    setResource(document);
  };

  const showErrorMessage = (message: string) => {
    openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: `${t('LWC:storage.invalid_request')}`,
        Body: () => (
          <Typography sx={{ '::first-letter': { textTransform: 'uppercase' } }}>
            {message}
          </Typography>
        ),
        onClose: async () => {
          disposeLeafWriter();
          navigate('/', { replace: true });
        },
      },
    });
  };

  return {
    loadFromPermalink,
  };
};
