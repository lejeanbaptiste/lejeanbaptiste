import Masonry from '@mui/lab/Masonry';
import { useOpenResource } from '@src/hooks';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import { useEffect, useState } from 'react';
import type { Layout } from '..';
import { CARD_WIDTH, DocumentCard } from '../components';

interface SamplesViewProps {
  layout?: Layout;
  width: number;
}

export const SamplesView = ({ layout, width }: SamplesViewProps) => {
  const { getSampleDocuments } = useActions().storage;

  const { openFromLibrary } = useOpenResource();

  const [samples, setSamples] = useState<Resource[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    loadSamples();
  }, []);

  const loadSamples = async () => {
    const documents = await getSampleDocuments();
    if (documents instanceof Error) return;
    setSamples(documents);
  };

  const handleClick = async (resource: Resource) => {
    const { url } = resource;
    if (!url) return setSelected(null);
    if (selected === url) return;
    setSelected(url);
  };

  const handleDoubleClick = async ({ title }: Resource) => {
    if (!title) return;
    openFromLibrary({ category: 'sample', title });
  };

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
      {samples.map((resource) => (
        <DocumentCard
          key={resource.url}
          layout={layout}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          selected={resource.url === selected}
          {...resource}
        />
      ))}
    </Masonry>
  );
};
