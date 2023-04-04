import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { db } from '@src/db';
import { usePermalink } from '@src/hooks';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import { useLiveQuery } from 'dexie-react-hooks';
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
  const { setResource } = useActions().editor;
  const { getStorageProviderAuth } = useActions().providers;
  const { removeRecentDocument } = useActions().storage;

  const recentDocs =
    useLiveQuery(() => db.recentDocuments.toCollection().reverse().sortBy('modifiedAt')) ?? [];

  const navigate = useNavigate();
  const { setPermalink } = usePermalink();

  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = async (resource: Resource) => {
    if (!resource.id) return setSelected(null);
    if (selected === resource.id) return handleDoubleClick(resource);
    setSelected(resource.id);
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

  const removeItem = (id: string) => removeRecentDocument(id);

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
