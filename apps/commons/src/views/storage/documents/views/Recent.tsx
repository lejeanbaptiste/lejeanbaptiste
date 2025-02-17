import { loadDocument } from '@cwrc/leafwriter-storage-service/headless';
import Masonry from '@mui/lab/Masonry';
import { db } from '@src/db';
import { useOpenResource } from '@src/hooks';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { Layout } from '..';
import { CARD_WIDTH, DocumentCard } from '../components';

interface RecentViewProps {
  layout?: Layout;
  width: number;
}

export const RecentView = ({ layout, width }: RecentViewProps) => {
  const { getStorageProviderAuth } = useActions().providers;
  const { removeRecentDocument } = useActions().storage;

  const { openResource } = useOpenResource();

  const recentDocs =
    useLiveQuery(() => db.recentDocuments.toCollection().reverse().sortBy('modifiedAt')) ?? [];

  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = async (resource: Resource) => {
    const { id } = resource;
    if (!id) return setSelected(null);
    if (selected === id) return;
    setSelected(id);
  };

  const handleDoubleClick = async (resource: Resource) => {
    const { provider } = resource;
    if (!provider) return;

    const providerAuth = getStorageProviderAuth(provider);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'message' in document || !document.content || !document.url) {
      return;
    }

    await openResource({ resource: document });
  };

  const removeItem = (id: string) => removeRecentDocument(id);

  const gap = 12;
  const columns = layout === 'grid' ? Math.floor((width - gap) / (CARD_WIDTH + gap)) : 1;
  const widthMasonry = columns * (CARD_WIDTH + gap);

  return (
    <Masonry
      columns={columns}
      spacing={1.5}
      sx={[
        {
          width: 'calc(100% - 32px)',
          mx: 1.5,
          pt: 1.5,
        },
        layout === 'grid' && { width: widthMasonry },
      ]}
    >
      <AnimatePresence>
        {recentDocs.map((resource) => (
          <DocumentCard
            key={resource.id}
            deletable={true}
            layout={layout}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onRemove={removeItem}
            selected={resource.id === selected}
            {...resource}
          />
        ))}
      </AnimatePresence>
    </Masonry>
  );
};
