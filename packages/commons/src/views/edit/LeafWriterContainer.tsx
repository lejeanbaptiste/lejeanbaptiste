import Leafwriter from '@cwrc/leafwriter';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect, useRef, type FC } from 'react';

const LeafWriterContainer: FC = () => {
  const { user } = useAppState().auth;
  const { leafWriter } = useAppState().editor;
  const { resource } = useAppState().storage;

  const { getLincsAauthenticationToken } = useActions().auth;
  const { addToRecentDocument } = useActions().storage;
  const { setIsDirty, setLeafWriter } = useActions().editor;

  const divEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divEl.current && !leafWriter && user && resource?.content) {
      const leafWriter = new Leafwriter(divEl.current, {
        document: {
          url: resource.url,
          xml: resource.content ?? '',
        },
        settings: {
          baseUrl: '.', // '.' | './'
          nerveUrl: 'https://localhost/nerve/',
          proxyLoaders: {
            cssEndpoint: '/schema/css/',
            xmlEndpoint: '/schema/xml/',
          },
          credentials: { nssiToken: getLincsAauthenticationToken },
          lookups: {
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

      setLeafWriter(leafWriter);

      // return () => {
      //   leafWriter.isDisrty.unsubscribe();
      // };
    }
  }, []);

  return <div ref={divEl} id="leaf-writer-container" style={{ height: 'calc(100vh - 48px)' }} />;
};

export default LeafWriterContainer;
