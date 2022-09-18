import { analytics } from '@src/analytics';
import { useActions, useAppState } from '@src/overmind';
import { Resource } from '@src/types';
import React, { useEffect, useRef, useState, type FC } from 'react';
import { useNavigate } from 'react-router';

const LeafWriterContainer: FC = () => {
  const { user } = useAppState().auth;
  const { resource } = useAppState().storage;
  const [currentResource, setCurrentResource] = useState<Resource>();

  const { getKeycloskAuthenticationToken } = useActions().auth;
  const { close, getGeonameUsername, setIsDirty, setLeafWriter } = useActions().editor;
  const { addToRecentDocument } = useActions().storage;

  const navigate = useNavigate();

  const divEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divEl.current && resource?.url !== currentResource?.url) {
      createLFInstance();
      return;
    }
    if (divEl.current && resource?.content) createLFInstance();
  }, [resource]);

  const createLFInstance = async () => {
    setCurrentResource(resource);
    const LWmodule = (await import('@cwrc/leafwriter')).default;

    if (user && resource?.content && divEl.current !== null) {
      const geonamesUsername = await getGeonameUsername();

      const leafWriter = new LWmodule(divEl.current, {
        document: {
          url: resource.url,
          xml: resource.content ?? '',
        },
        settings: {
          credentials: { nssiToken: getKeycloskAuthenticationToken },
          lookups: {
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
