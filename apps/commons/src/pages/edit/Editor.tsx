import { Box } from '@mui/material';
import { LoadingMask } from '@src/components';
import { schemas } from '@src/config/schemas';
import { useAnalytics, useLeafWriter } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { useEffect, useRef } from 'react';
import { useMenu } from './topbar';

export const Editor = () => {
  const { userState, user } = useAppState().auth;
  const { libLoaded, readonly, resource } = useAppState().editor;

  const { getKeycloakAuthToken } = useActions().auth;
  const { getGeonameUsername, loadLeafWriter } = useActions().editor;

  const { analytics } = useAnalytics();

  const { onKeydownHandle } = useMenu();
  const { leafWriter, setEditorEvents, setCurrentLeafWriter } = useLeafWriter();

  const divEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resource?.content) return;

    loadLib();
    window.addEventListener('keydown', onKeydownHandle);

    return () => {
      window.removeEventListener('keydown', onKeydownHandle);
      setCurrentLeafWriter(null);
    };
  }, []);

  useEffect(() => {
    if (leafWriter) initLeafWriter();
  }, [leafWriter]);

  const loadLib = async () => {
    if (!divEl.current) return;
    const lw = await loadLeafWriter(divEl.current);
    setCurrentLeafWriter(lw);
  };

  const initLeafWriter = async () => {
    if (!leafWriter || !resource?.content) return;

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
        authorityServices: [{ id: 'geonames', settings: { username: geonamesUsername } }],
        credentials: { nssiToken: userState === 'AUTHENTICATED' ? getKeycloakAuthToken : '' },
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
    <Box ref={divEl} id="leaf-writer-container" style={{ height: 'calc(100vh - 48px)' }}>
      {(!libLoaded || !resource) && <LoadingMask />}
    </Box>
  );
};
