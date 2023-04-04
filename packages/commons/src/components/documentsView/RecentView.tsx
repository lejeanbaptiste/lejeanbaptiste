import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import type { Resource } from '@src/types';
import { AnimatePresence } from 'framer-motion';
import React, { useState } from 'react';
import Masonry from '@mui/lab/Masonry';
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

  const handleDoubleClick = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    const permalink = setPermalink(document);
    const route = resource.writePermission === false ? 'view' : 'edit';
    navigate(`/${route}${permalink ?? ''}`, { replace: true });
  };

  const removeItem = (url: string) => removeRecentDocument(url);

  const gap = 12;
  const columns = displayLayout === 'grid' ? Math.floor((width - gap) / (CARD_WIDTH + gap)) : 1;
  const widthMasonry = columns * (CARD_WIDTH + gap);

  return (
    <Masonry
      columns={columns}
      spacing={1.5}
      sx={{
        width: displayLayout === 'grid' ? widthMasonry : 'calc(100% - 32px)',
        mx: 1.5,
        pt: 1.5,
      }}
    >
      <AnimatePresence>
        {recentDocs.map((resource) => (
          <DocumentCard
            key={resource.id}
            deletable={true}
            displayLayout={displayLayout}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onRemove={removeItem}
            resource={resource}
            selected={resource.id === selected}
          />
        ))}
      </AnimatePresence>
    </Masonry>
  );
};
