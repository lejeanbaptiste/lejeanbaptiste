import Masonry from '@mui/lab/Masonry';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DisplayLayout } from '.';
import { CARD_WIDTH, DocumentCard } from './components';

interface SamplesViewProps {
  displayLayout?: DisplayLayout;
  width: number;
}

export const SamplesView = ({ displayLayout, width }: SamplesViewProps) => {
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
    if (!resource.url) return setSelected(null);
    if (selected === resource.url) return handleDoubleClick(resource);
    setSelected(resource.url);
  };

  const handleDoubleClick = async ({ title, url }: Resource) => {
    if (!url) return;
    const content = await loadSample(url);
    setResource({ content, filename: `${title}.xml` });
    navigate(`/edit?sample=${title}`, { replace: true });
  };

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
      {samples.map((resource) => (
        <DocumentCard
          key={resource.url}
          displayLayout={displayLayout}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          resource={resource}
          selected={resource.url === selected}
        />
      ))}
    </Masonry>
  );
};
