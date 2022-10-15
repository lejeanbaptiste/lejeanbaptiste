import { LoadingMask } from '@src/components';
import { useAnalytics } from '@src/hooks';
import { Page, TopBar } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect, useRef, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MainMenu, Meta, useMenu } from './topbar';
import { useLeafWriter } from './useLeafWriter';

export const EditView: FC = () => {
  const { userState, user } = useAppState().auth;
  const { autosave, libLoaded } = useAppState().editor;
  const { resource } = useAppState().storage;

  const { getKeycloakAuthToken } = useActions().auth;
  const {
    close,
    getGeonameUsername,
    loadLeafWriter,
    setAutosave,
    setContentLastSaved,
    setIsDirty,
    subscribeToTimerService,
    unsubscribeFromTimerService,
  } = useActions().editor;
  const { addToRecentDocument } = useActions().storage;

  const { setPage } = useActions().ui;

  const navigate = useNavigate();
  const { t } = useTranslation('commons');

  const { analytics } = useAnalytics();

  const { disposeLeafWriter, leafWriter, loadDocumentFromPermalink, setCurrentLeafWriter } =
    useLeafWriter();
  const { onKeydownHandle } = useMenu();

  const divEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // if (divEl.current && !leafWriter) loadLib();
    setPage('edit');
    window.addEventListener('keydown', onKeydownHandle);
    return () => {
      window.removeEventListener('keydown', onKeydownHandle);
      setCurrentLeafWriter(null);
    };
  }, []);

  useEffect(() => {
    if (userState === 'AUTHENTICATED') {
      if (!resource) loadDocumentFromPermalink();
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
    if (resource.content) initLeafWriter();
  };

  const loadLib = async () => {
    if (!divEl.current) return;
    const lw = await loadLeafWriter(divEl.current);
    setCurrentLeafWriter(lw);
  };

  const initLeafWriter = async () => {
    if (!leafWriter || !resource?.content) return;

    const geonamesUsername = await getGeonameUsername();

    leafWriter.init({
      document: {
        url: resource.url,
        xml: resource.content ?? '',
      },
      settings: {
        credentials: { nssiToken: userState === 'AUTHENTICATED' ? getKeycloakAuthToken : '' },
        lookups: {
          authorities: [['geonames', { config: { username: geonamesUsername } }]],
        },
      },
      user: user && {
        avatar_url: user.avatar_url,
        email: user.email,
        name: `${user?.firstName} ${user?.lastName}`,
        uri: user?.url,
      },
    });

    leafWriter.isDirty.subscribe((value) => {
      setIsDirty(value);
    });

    leafWriter.onLoad.subscribe(async ({ schemaName }) => {
      subscribeToTimerService(leafWriter);
      addToRecentDocument({ ...resource, schemaName });

      const content = await leafWriter.getContent();
      setContentLastSaved(content);
      leafWriter.autosave = autosave;
    });

    leafWriter.onClose.subscribe(() => {
      unsubscribeFromTimerService();
      disposeLeafWriter();
    });

    leafWriter.onEditorStateChange.subscribe((editorState) => {
      if (editorState.autosave !== undefined && editorState.autosave !== autosave) {
        setAutosave(editorState.autosave);
      }
    });

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
