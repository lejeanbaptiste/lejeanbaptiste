import { Leafwriter } from '@cwrc/leafwriter';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect, useRef, type FC } from 'react';
import { analytics } from '@src/analytics';

const LeafWriterContainer: FC = () => {
  const { user } = useAppState().auth;
  const { leafWriter } = useAppState().editor;
  const { resource } = useAppState().storage;

  const { getKeycloskAuthenticationToken } = useActions().auth;
  const { getGeonameUsername, setIsDirty, setLeafWriter } = useActions().editor;
  const { addToRecentDocument } = useActions().storage;

  const navigate = useNavigate();

  const divEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divEl.current && !leafWriter) createLFInstance();
  }, []);

  const createLFInstance = async () => {
    if (user && resource?.content) {
      const geonamesUsername = await getGeonameUsername();

      const leafWriter = new Leafwriter(divEl.current, {
        document: {
          url: resource.url,
          xml: resource.content ?? '',
        },
        settings: {
          credentials: { nssiToken: getKeycloskAuthenticationToken },
          lookups: {
            //@ts-ignore
            authorities: [['geonames', { config: { username: geonamesUsername } }]],
          },
        },
        user: {
          avatar_url: user.avatar_url,
          email: user.email,
          name: `${user?.firstName} ${user?.lastName}`,
          uri: user?.url,
        },
      });

      leafWriter.isDirty.subscribe((value) => setIsDirty(value));
      leafWriter.onLoad.subscribe(({ schemaName }) => {
        addToRecentDocument({ ...resource, schemaName });
      });

      leafWriter.onClose.subscribe(() => {
        close();
        setIsDirty(false);
        navigate('/', { replace: true });
      });

      setLeafWriter(leafWriter);

      analytics.track('editor', { opened: true });

      // return () => {
      //   leafWriter.isDisrty.unsubscribe();
      // };
    }
  };

  return <div ref={divEl} id="leaf-writer-container" style={{ height: 'calc(100vh - 48px)' }} />;
};

export default LeafWriterContainer;
