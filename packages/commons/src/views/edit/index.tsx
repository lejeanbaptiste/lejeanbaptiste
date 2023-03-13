import { LoadingMask } from '@src/components';
import { schemas } from '@src/config/schemas';
import { useAnalytics } from '@src/hooks';
import { Page, TopBar } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import queryString from 'query-string';
import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainMenu, Meta, useMenu } from './topbar';
import { useLeafWriter } from './useLeafWriter';

export const EditView = () => {
  const { userState, user } = useAppState().auth;
  const { contentHasChanged, libLoaded, readonly, resource } = useAppState().editor;

  const { getKeycloakAuthToken } = useActions().auth;
  const { close, getGeonameUsername, loadLeafWriter, setReadonly } = useActions().editor;
  const { setPage } = useActions().ui;

  const navigate = useNavigate();
  const location = useLocation();

  const { analytics } = useAnalytics();

  const { leafWriter, loadFromPermalink, setEditorEvents, setCurrentLeafWriter } = useLeafWriter();
  const { onKeydownHandle } = useMenu();

  const divEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage('edit');
    window.addEventListener('keydown', onKeydownHandle);
    const { readonly } = queryString.parse(location.search);
    if (readonly) setReadonly(readonly === 'true' ? true : false);
    return () => {
      window.removeEventListener('keydown', onKeydownHandle);
      setCurrentLeafWriter(null);
    };
  }, []);

  useEffect(() => {
    if (userState === 'AUTHENTICATED') {
      if (!resource) loadFromPermalink();
      loadLib();
      return;
    }

    if (userState === 'UNAUTHENTICATED') {
      if (!resource) {
        close();
        navigate('/', { replace: true });
        return;
      }

      loadLib();
    }
  }, [userState]);

  useEffect(() => {
    if (leafWriter) initLeafWriter();
  }, [leafWriter]);

  useEffect(() => {
    handleResource();
  }, [resource]);

  const handleResource = async () => {
    if (!resource) return;
    if (!resource.owner) return;
    if (resource.content) initLeafWriter();
  };

  const loadLib = async () => {
    if (!divEl.current) return;
    const lw = await loadLeafWriter(divEl.current);
    setCurrentLeafWriter(lw);
  };

  const initLeafWriter = async () => {
    if (!leafWriter || !resource?.content) return;
    if (contentHasChanged) return;

    const geonamesUsername = await getGeonameUsername();

    const author = user && {
      name: user.identities.get(user.preferredID)?.name ?? `${user.firstName} ${user.lastName}`,
      uri: user?.identities.get(user.preferredID)?.uri ?? '',
    };

    leafWriter.init({
      document: {
        url: resource.url,
        xml: resource.content ?? '',
      },
      settings: {
        credentials: { nssiToken: userState === 'AUTHENTICATED' ? getKeycloakAuthToken : '' },
        lookups: { authorities: [['geonames', { config: { username: geonamesUsername } }]] },
        readonly,
        schemas,
      },
      user: author,
    });

    setEditorEvents();

    if (analytics) {
      analytics.track('editor', { opened: true });
      analytics.page();
    }
  };

  return (
    <Page>
      <TopBar Left={<MainMenu />} Meta={<Meta />} />
      <div ref={divEl} id="leaf-writer-container" style={{ height: 'calc(100vh - 48px)' }}>
        {(!libLoaded || !resource) && <LoadingMask />}
      </div>
    </Page>
  );
};
