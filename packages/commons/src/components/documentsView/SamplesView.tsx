import { useTheme } from '@mui/material';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import React, { useEffect, useState } from 'react';
import Masonry from 'react-responsive-masonry';
import { useNavigate } from 'react-router';
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
  const { spacing } = useTheme();

  const [samples, setSamples] = useState<Resource[]>([]);

  useEffect(() => {
    loadSamples();
  }, []);

  const loadSamples = async () => {
    const documents = await getSampleDocuments();
    setSamples(documents);
  };

  const load = async ({ title, url }: Resource) => {
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
      columnsCount={columns}
      gutter={`${gap}px`}
      style={{
        marginInline: spacing(1.5),
        paddingTop: spacing(1.5),
        width: displayLayout === 'grid' ? widthMasonry : 'calc(100% - 24px)',
      }}
    >
      {samples.map((resource) => (
        <DocumentCard
          key={resource.url}
          displayLayout={displayLayout}
          onClick={load}
          resource={resource}
        />
      ))}
    </Masonry>
  );
};
