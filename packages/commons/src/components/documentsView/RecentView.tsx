import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { useTheme } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import type { Resource } from '@src/types';
import React, { useEffect, useState } from 'react';
import Masonry from 'react-responsive-masonry';
import { useNavigate } from 'react-router-dom';
import type { DisplayLayout } from '.';
import { CARD_WIDTH, DocumentCard } from './components';

interface RecentViewProps {
  displayLayout?: DisplayLayout;
  width: number;
}

export const RecentView = ({ displayLayout, width }: RecentViewProps) => {
  const { recentDocuments } = useAppState().storage;
  const { setResource } = useActions().editor;
  const { getStorageProviderAuth } = useActions().providers;
  const { loadRecentFiles, removeRecentDocument } = useActions().storage;

  const navigate = useNavigate();
  const { setPermalink } = usePermalink();
  const { spacing } = useTheme();

  const [recents, setRecents] = useState<Resource[]>([]);

  useEffect(() => {
    loadRecents();
  }, []);

  useEffect(() => {
    if (recentDocuments) setRecents(recentDocuments);
  }, [recentDocuments]);

  const loadRecents = async () => {
    const documents = recentDocuments ? recentDocuments : await loadRecentFiles();
    setRecents(documents);
  };

  const load = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    const permalink = setPermalink(document);
    navigate(`/edit${permalink}`, { replace: true });
  };

  const removeItem = (url: string) => removeRecentDocument(url);

  const gap = 12;
  const columns = displayLayout === 'grid' ? Math.floor((width - gap) / (CARD_WIDTH + gap)) : 1;
  const widthMasonry = columns * (CARD_WIDTH + gap);

  return (
    <Masonry
      columnsCount={columns}
      gutter={`${gap}px`}
      style={{
        marginInline: spacing(1.5),
        paddingTop: spacing(1.5),
        width: displayLayout === 'grid' ? widthMasonry : 'calc(100% - 24px)',
      }}
    >
      {recents.map((resource) => (
        <DocumentCard
          key={resource.url}
          deletable={true}
          displayLayout={displayLayout}
          onClick={load}
          onRemove={removeItem}
          resource={resource}
        />
      ))}
    </Masonry>
  );
};
