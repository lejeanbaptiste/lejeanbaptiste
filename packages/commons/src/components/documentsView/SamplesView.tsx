import Masonry from '@mui/lab/Masonry';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Layout } from '.';
import { CARD_WIDTH, DocumentCard } from './components';

interface SamplesViewProps {
  layout?: Layout;
  width: number;
}

export const SamplesView = ({ layout, width }: SamplesViewProps) => {
  const { setResource } = useActions().editor;
  const { getSampleDocuments, loadSample } = useActions().storage;

  const navigate = useNavigate();

  const [samples, setSamples] = useState<Resource[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    loadSamples();
  }, []);

  const loadSamples = async () => {
    const documents = await getSampleDocuments();
    setSamples(documents);
  };

  const handleClick = async (resource: Resource) => {
    const { url } = resource;
    if (!url) return setSelected(null);
    if (selected === url) return handleDoubleClick(resource);
    setSelected(url);
  };

  const handleDoubleClick = async ({ title, url }: Resource) => {
    if (!url) return;
    const content = await loadSample(url);
    setResource({ content, filename: `${title}.xml` });
    navigate(`/edit?sample=${title}`, { replace: true });
  };

  const gap = 12;
  const columns = layout === 'grid' ? Math.floor((width - gap) / (CARD_WIDTH + gap)) : 1;
  const widthMasonry = columns * (CARD_WIDTH + gap);

  return (
    <Masonry
      columns={columns}
      spacing={1.5}
      sx={{
        width: layout === 'grid' ? widthMasonry : 'calc(100% - 32px)',
        mx: 1.5,
        pt: 1.5,
      }}
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
